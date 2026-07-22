import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_MODELS = 30;

type ToggleBody = {
  modelId?: string;
  active?: boolean;
};

export async function PATCH(request: Request) {
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
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: "Perfil inválido." },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    if (role !== "owner" && role !== "administrator") {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as ToggleBody;

    if (!body.modelId || typeof body.active !== "boolean") {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 },
      );
    }

    if (body.active) {
      const {
        data: model,
        error: modelError,
      } = await supabase
        .from("models")
        .select("active")
        .eq("id", body.modelId)
        .maybeSingle();

      if (modelError) {
        return NextResponse.json(
          { error: modelError.message },
          { status: 500 },
        );
      }

      if (!model) {
        return NextResponse.json(
          { error: "Modelo não encontrada." },
          { status: 404 },
        );
      }

      if (!model.active) {
        const { count, error: countError } = await supabase
          .from("models")
          .select("id", { count: "exact", head: true })
          .eq("active", true);

        if (countError) {
          return NextResponse.json(
            { error: countError.message },
            { status: 500 },
          );
        }

        if ((count ?? 0) >= MAX_ACTIVE_MODELS) {
          return NextResponse.json(
            {
              error:
                "Você atingiu o máximo de 30 modelos ativas. Inative outra modelo primeiro.",
            },
            { status: 409 },
          );
        }
      }
    }

    const { error: updateError } = await supabase
      .from("models")
      .update({
        active: body.active,
        status: body.active ? "active" : "inactive",
      })
      .eq("id", body.modelId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      active: body.active,
    });
  } catch (error) {
    console.error("Erro ao alterar status da modelo:", error);

    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 },
    );
  }
}
