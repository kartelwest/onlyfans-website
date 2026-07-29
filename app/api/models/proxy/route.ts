import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isCountryCode } from "@/lib/countries";
import { isProxyCompany, isValidProxyIp } from "@/lib/models/proxyDetails";

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
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 403 });
    }

    if ((profile.role as ManagementRole) !== "owner") {
      return NextResponse.json(
        { error: "Apenas o proprietário pode editar estes campos." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;

    if (!body.modelId) {
      return NextResponse.json(
        { error: "Identificação da modelo não informada." },
        { status: 400 },
      );
    }

    const proxyIp = body.proxyIp?.trim() || null;

    if (proxyIp && !isValidProxyIp(proxyIp)) {
      return NextResponse.json(
        { error: "Informe um IP válido, por exemplo 48.45.165.230." },
        { status: 400 },
      );
    }

    const rawCompany = body.proxyCompany?.trim() || null;

    if (rawCompany !== null && !isProxyCompany(rawCompany)) {
      return NextResponse.json(
        { error: "Empresa inválida." },
        { status: 400 },
      );
    }

    const proxyCompany: ProxyCompany | null = rawCompany;

    const proxyCompanyOther = body.proxyCompanyOther?.trim() || null;

    if (proxyCompany === "other" && !proxyCompanyOther) {
      return NextResponse.json(
        { error: "Informe o nome da empresa do proxy." },
        { status: 400 },
      );
    }

    const proxyCountry = body.proxyCountry?.trim() || null;

    if (proxyCountry && !isCountryCode(proxyCountry)) {
      return NextResponse.json({ error: "País inválido." }, { status: 400 });
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
        { error: "Erro interno ao salvar dados de proxy." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar dados de proxy:", error);

    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
