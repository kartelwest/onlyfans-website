import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCountryCode } from "@/lib/countries";
import { isProxyCompany, isValidProxyIp } from "@/lib/models/proxyDetails";
import { logAuditEntry } from "@/lib/audit/auditLogger";

import type { ManagementRole, ProxyCompany } from "@/types/model";

/**
 * The proxy as one readable line — "48.45.165.230 · Proxy Empire · BR".
 *
 * Doubles as the comparison key: two saves describe the same proxy exactly
 * when this returns the same string, so "did anything actually change" needs
 * no field-by-field diff. Empty when the model has no proxy at all.
 */
function describeProxy(
  ip: string | null,
  company: string | null,
  companyOther: string | null,
  country: string | null,
): string {
  const companyLabel =
    company === "other" ? companyOther?.trim() || "" : company ?? "";

  return [ip?.trim() || "", companyLabel, country?.trim() || ""]
    .filter(Boolean)
    .join(" · ");
}

type Body = {
  modelId?: string;
  proxyIp?: string | null;
  proxyCompany?: string | null;
  proxyCompanyOther?: string | null;
  proxyCountry?: string | null;
};

// PROXY / COMPANY NAME / COUNTRY are readable by any management role but
// writable by the owner alone. The columns aren't selectable or updatable by
// the `authenticated` Postgres role at all (see the model_proxy_details
// migration): the only path is the set_model_proxy_details RPC, which
// self-checks public.is_owner() at the database level.
export async function PATCH(request: Request) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.proxy");
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json({ error: t("invalidProfile") }, { status: 403 });
    }

    if ((profile.role as ManagementRole) !== "owner") {
      return NextResponse.json(
        { error: tRoute("ownerOnly") },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;

    if (!body.modelId) {
      return NextResponse.json(
        { error: t("modelIdMissing") },
        { status: 400 },
      );
    }

    const proxyIp = body.proxyIp?.trim() || null;

    if (proxyIp && !isValidProxyIp(proxyIp)) {
      return NextResponse.json(
        { error: tRoute("invalidIp") },
        { status: 400 },
      );
    }

    const rawCompany = body.proxyCompany?.trim() || null;

    if (rawCompany !== null && !isProxyCompany(rawCompany)) {
      return NextResponse.json(
        { error: tRoute("invalidCompany") },
        { status: 400 },
      );
    }

    const proxyCompany: ProxyCompany | null = rawCompany;

    const proxyCompanyOther = body.proxyCompanyOther?.trim() || null;

    if (proxyCompany === "other" && !proxyCompanyOther) {
      return NextResponse.json(
        { error: tRoute("companyRequired") },
        { status: 400 },
      );
    }

    const proxyCountry = body.proxyCountry?.trim() || null;

    if (proxyCountry && !isCountryCode(proxyCountry)) {
      return NextResponse.json({ error: tRoute("invalidCountry") }, { status: 400 });
    }

    // What is there right now, read before anything is written. Two reasons:
    // the audit row can carry the value being replaced instead of a null, and
    // a save that changes nothing can be recognised as such — otherwise
    // re-opening the panel and pressing Save would file a fresh "new proxy
    // assigned" note against a model whose proxy never moved.
    const { data: previousRow } = await supabase
      .rpc("get_model_proxy_details", { target_model: body.modelId })
      .maybeSingle<{
        proxy_ip: string | null;
        proxy_company: string | null;
        proxy_company_other: string | null;
        proxy_country: string | null;
      }>();

    const previous = describeProxy(
      previousRow?.proxy_ip ?? null,
      previousRow?.proxy_company ?? null,
      previousRow?.proxy_company_other ?? null,
      previousRow?.proxy_country ?? null,
    );

    const next = describeProxy(
      proxyIp,
      proxyCompany,
      proxyCompanyOther,
      proxyCountry,
    );

    if (previous === next) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    const { error } = await supabase.rpc("set_model_proxy_details", {
      target_model: body.modelId,
      new_proxy_ip: proxyIp,
      new_proxy_company: proxyCompany,
      new_proxy_company_other: proxyCompanyOther,
      new_proxy_country: proxyCountry,
    });

    if (error) {
      console.error("Erro ao salvar dados de proxy:", error);

      return NextResponse.json(
        { error: tRoute("saveFailed") },
        { status: 500 },
      );
    }

    const actor = {
      id: profile.id,
      fullName: profile.full_name || t("unknownUser"),
      role: profile.role as ManagementRole,
    };

    await logAuditEntry(supabase, {
      modelId: body.modelId,
      action: "proxy_update",
      fieldName: "proxy_details",
      previousValue: previous || null,
      newValue: next || null,
      actor,
      source: "api:/api/models/proxy",
      summary: `Dados de proxy atualizados (IP: ${proxyIp ?? "—"}, empresa: ${proxyCompany ?? "—"}, país: ${proxyCountry ?? "—"})`,
    });

    // The assignment, in the Notes tab where the team reads. Written in the
    // language of whoever assigned it, and never rewritten afterwards — the
    // same rule the history follows.
    //
    // A failure here does not fail the request: the proxy is already saved and
    // already in the audit trail, and losing the note is not worth telling the
    // owner his save did not work when it did.
    const noteBody = next
      ? tRoute("noteAssigned", { proxy: next })
      : tRoute("noteRemoved");

    const { data: note, error: noteError } = await supabase
      .from("model_notes")
      .insert({
        model_id: body.modelId,
        body: noteBody,
        priority: "important",
        pinned: false,
        archived: false,
        source: "proxy",
        created_context: "staff",
        created_by: actor.id,
        created_by_name: actor.fullName,
        created_by_role: actor.role,
        updated_by: actor.id,
        updated_by_name: actor.fullName,
        updated_by_role: actor.role,
      })
      .select("id")
      .single();

    if (noteError || !note) {
      console.error("Erro ao registrar a nota de proxy:", noteError);
    } else {
      const { error: noteHistoryError } = await supabase
        .from("model_note_history")
        .insert({
          note_id: note.id,
          model_id: body.modelId,
          action: "created",
          original_body: null,
          updated_body: noteBody,
          editor_id: actor.id,
          editor_name: actor.fullName,
          editor_role: actor.role,
        });

      if (noteHistoryError) {
        console.error(
          "Erro ao registrar o histórico da nota de proxy:",
          noteHistoryError,
        );
      }
    }

    // The proxy is shown in two places now: the panel it was typed into, and
    // the card on /admin/pageview. Both are dynamic renders, but a render
    // already sitting in the router cache would keep showing the old address
    // after a navigation. Dropping them here is what makes the Pageview card
    // agree with the panel as soon as Save is pressed, rather than whenever
    // the cache happened to expire.
    revalidatePath("/admin/pageview");
    revalidatePath("/admin/models/[slug]", "page");
    revalidatePath("/admin/models");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar dados de proxy:", error);

    return NextResponse.json({ error: t("internal") }, { status: 500 });
  }
}
