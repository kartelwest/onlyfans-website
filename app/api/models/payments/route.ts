import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return NextResponse.json(
      { error: "Perfil inválido." },
      { status: 403 },
    );
  }

  const modelId =
    request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  // Verify model access based on role
  let canAccess = false;

  if (profile.role === "owner" || profile.role === "administrator") {
    // Staff can access all models
    const { data: model } = await supabase
      .from("models")
      .select("id")
      .eq("id", modelId)
      .maybeSingle();
    canAccess = !!model;
  } else if (profile.role === "representative") {
    // Rep can only access assigned models
    const { data: model } = await supabase
      .from("models")
      .select("id")
      .eq("id", modelId)
      .eq("representative_id", user.id)
      .maybeSingle();
    canAccess = !!model;
  }

  if (!canAccess) {
    return NextResponse.json(
      { error: "Sem permissão." },
      { status: 403 },
    );
  }

  // Use request-scoped client for data access (RLS enforced)
  const { data, error } = await supabase
    .from("model_payments")
    .select("*")
    .eq("model_id", modelId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar pagamentos:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar pagamentos." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    payment: data,
  });
}
