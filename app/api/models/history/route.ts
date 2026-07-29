import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ManagementRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
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
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: "Perfil inválido." },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    if (role === "model") {
      return NextResponse.json(
        { error: "Modelos não têm acesso ao histórico de auditoria." },
        { status: 403 },
      );
    }

    const modelId = request.nextUrl.searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        { error: "Identificação da modelo não informada." },
        { status: 400 },
      );
    }

    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id, representative_id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError || !model) {
      return NextResponse.json(
        { error: "Modelo não encontrada." },
        { status: 404 },
      );
    }

    if (
      role === "representative" &&
      model.representative_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
    }

    const action = request.nextUrl.searchParams.get("action");
    const fieldName = request.nextUrl.searchParams.get("fieldName");
    const actorId = request.nextUrl.searchParams.get("actorId");
    const pageStr = request.nextUrl.searchParams.get("page");
    const pageSizeStr = request.nextUrl.searchParams.get("pageSize");

    const page = Math.max(1, Number(pageStr) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(pageSizeStr) || DEFAULT_PAGE_SIZE),
    );

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("model_audit_history")
      .select(
        `
          id,
          model_id,
          action,
          field_name,
          previous_value,
          new_value,
          actor_id,
          actor_name,
          actor_role,
          source,
          summary,
          created_at
        `,
        { count: "exact" },
      )
      .eq("model_id", modelId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (action) {
      query = query.eq("action", action);
    }

    if (fieldName) {
      query = query.eq("field_name", fieldName);
    }

    if (actorId) {
      query = query.eq("actor_id", actorId);
    }

    const { data: entries, error: entriesError, count } = await query;

    if (entriesError) {
      console.error("Erro ao carregar histórico de auditoria:", entriesError);
      return NextResponse.json(
        { error: "Erro interno ao carregar histórico." },
        { status: 500 },
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return NextResponse.json({
      entries: (entries ?? []).map(mapEntry),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Erro inesperado ao carregar histórico:", error);

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado ao carregar o histórico." },
      { status: 500 },
    );
  }
}

function mapEntry(entry: Record<string, unknown>) {
  return {
    id: String(entry.id ?? ""),
    modelId: String(entry.model_id ?? ""),
    action: String(entry.action ?? ""),
    fieldName: entry.field_name ?? null,
    previousValue: entry.previous_value ?? null,
    newValue: entry.new_value ?? null,
    actorId: entry.actor_id ?? null,
    actorName: String(entry.actor_name ?? "Usuário"),
    actorRole: String(entry.actor_role ?? "administrator"),
    source: entry.source ?? null,
    summary: String(entry.summary ?? ""),
    createdAt: String(entry.created_at ?? new Date().toISOString()),
  };
}
