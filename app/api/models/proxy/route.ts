import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCountryCode } from "@/lib/countries";
import { isProxyCompany, isValidProxyIp } from "@/lib/models/proxyDetails";
import { logAuditEntry } from "@/lib/audit/auditLogger";

import type { ManagementRole, ProxyCompany } from "@/types/model";

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

    await logAuditEntry(supabase, {
      modelId: body.modelId,
      action: "proxy_update",
      fieldName: "proxy_details",
      previousValue: null,
      newValue: [proxyIp, proxyCompany, proxyCompanyOther, proxyCountry].filter(Boolean).join(" / ") || null,
      actor: {
        id: profile.id,
        fullName: profile.full_name || "Usuário",
        role: profile.role as ManagementRole,
      },
      source: "api:/api/models/proxy",
      summary: `Dados de proxy atualizados (IP: ${proxyIp ?? "—"}, empresa: ${proxyCompany ?? "—"}, país: ${proxyCountry ?? "—"})`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar dados de proxy:", error);

    return NextResponse.json({ error: t("internal") }, { status: 500 });
  }
}
