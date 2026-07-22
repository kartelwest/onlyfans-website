import { NextRequest, NextResponse } from "next/server";

import {
  getAuthenticatedProfile,
  verifyModelAccess,
} from "@/lib/auth/model-access";
import { createClient } from "@/lib/supabase/server";

import type { ManagementRole, ModelAuditLog } from "@/types/model";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const auth = await getAuthenticatedProfile();

    if (!auth.ok) {
      return auth.response;
    }

    const { profile } = auth;

    const modelId =
      request.nextUrl.searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        { error: "O ID da modelo é obrigatório." },
        { status: 400 },
      );
    }

    const access = await verifyModelAccess(
      modelId,
      profile,
    );

    if (!access.ok) {
      return access.response;
    }

    const supabase = await createClient();

    const {
      data: auditLogs,
      error: auditError,
    } = await supabase
      .from("model_audit_log")
      .select(
        `
          id,
          model_id,
          actor_id,
          actor_name,
          actor_role,
          field,
          old_value,
          new_value,
          created_at
        `,
      )
      .eq("model_id", modelId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (auditError) {
      console.error(
        "Erro ao carregar logs de auditoria:",
        auditError,
      );

      return NextResponse.json(
        { error: "Não foi possível carregar o histórico." },
        { status: 500 },
      );
    }

    const logs: ModelAuditLog[] = (auditLogs ?? []).map(
      (log) => ({
        id: log.id,
        modelId: log.model_id,
        actorId: log.actor_id,
        actorName: log.actor_name,
        actorRole: log.actor_role as ManagementRole | null,
        field: log.field,
        oldValue: log.old_value,
        newValue: log.new_value,
        createdAt: log.created_at,
      }),
    );

    return NextResponse.json({ logs });
  } catch (error) {
    console.error(
      "Erro inesperado ao carregar auditoria:",
      error,
    );

    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 },
    );
  }
}
