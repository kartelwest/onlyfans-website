import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ensureOnlyFansEnrollmentForModel } from "@/lib/brand/talent";
import { logAuditEntry } from "@/lib/audit/auditLogger";
import type { ManagementRole, ModelStatus } from "@/types/model";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_MODELS = 30;

const VALID_STATUSES: ModelStatus[] = [
  "active",
  "inactive",
  "candidate",
  "denied",
];

type StatusBody = {
  modelId?: string;
  status?: string;
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

    const { data: profile, error: profileError } = await supabase
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

    if (role !== "owner" && role !== "administrator") {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as StatusBody;

    if (
      !body.modelId ||
      !body.status ||
      !VALID_STATUSES.includes(body.status as ModelStatus)
    ) {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 },
      );
    }

    const status = body.status as ModelStatus;
    const willBeActive = status === "active";

    if (willBeActive) {
      const { data: model, error: modelError } = await supabase
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

    const { data: existingModel } = await supabase
      .from("models")
      .select("status, active")
      .eq("id", body.modelId)
      .maybeSingle();

    // Ensure the canonical talent record and OnlyFans service enrollment
    // exist before changing the model status. A DB trigger keeps the
    // enrollment status in sync with models.active; this call guarantees the
    // talent row is present for new or legacy models.
    const { error: ensureError } = await ensureOnlyFansEnrollmentForModel(body.modelId);
    if (ensureError) {
      return NextResponse.json(
        { error: ensureError },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("models")
      .update({
        active: willBeActive,
        status,
      })
      .eq("id", body.modelId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    await logAuditEntry(supabase, {
      modelId: body.modelId,
      action: "status_change",
      fieldName: "status",
      previousValue: existingModel?.status ?? null,
      newValue: status,
      actor: {
        id: profile.id,
        fullName: profile.full_name || "Usuário",
        role,
      },
      source: "api:/api/models/status",
      summary: `Status alterado de "${existingModel?.status ?? "—"}" para "${status}"`,
    });

    return NextResponse.json({
      success: true,
      status,
      active: willBeActive,
    });
  } catch (error) {
    console.error("Erro ao alterar status da modelo:", error);

    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 },
    );
  }
}
