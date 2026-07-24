import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import type { ManagementRole } from "@/types/model";

type Body = {
  modelId?: string;
  instagramMarketing?: string;
  twitterMarketing?: string;
};

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return {
      error: NextResponse.json(
        { error: "Perfil inválido." },
        { status: 403 },
      ),
    };
  }

  const role = profile.role as ManagementRole;

  if (role !== "owner" && role !== "administrator") {
    return {
      error: NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      ),
    };
  }

  return { error: null };
}

// Section 6 — Social Accounts (Marketing). instagram_marketing /
// twitter_marketing are not selectable via a normal `.from("models")` query
// for the `authenticated` Postgres role (see the models_column_select_allowlist
// migration) — the only path to these fields, for any role, is the
// get_model_marketing / set_model_marketing RPCs, which self-check
// public.is_management() at the database level.
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { error: authError } = await requireStaff(supabase);
  if (authError) {
    return authError;
  }

  const modelId = request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .rpc("get_model_marketing", { target_model: modelId })
    .maybeSingle<{
      instagram_marketing: string | null;
      twitter_marketing: string | null;
    }>();

  if (error) {
    console.error("Erro ao carregar contas de marketing:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar contas de marketing." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    instagramMarketing: data?.instagram_marketing ?? null,
    twitterMarketing: data?.twitter_marketing ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const { error: authError } = await requireStaff(supabase);
  if (authError) {
    return authError;
  }

  const body = (await request.json()) as Body;

  if (!body.modelId) {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("set_model_marketing", {
    target_model: body.modelId,
    new_instagram_marketing: body.instagramMarketing?.trim() || null,
    new_twitter_marketing: body.twitterMarketing?.trim() || null,
  });

  if (error) {
    console.error("Erro ao salvar contas de marketing:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar contas de marketing." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
