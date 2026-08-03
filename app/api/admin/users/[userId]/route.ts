import { NextResponse } from "next/server";

import { logStaffAudit } from "@/lib/audit/staffAudit";
import { isStaffRole } from "@/lib/auth/roles";
import {
  accountStatus,
  statusColumns,
  STAFF_STATUS_LABELS,
  type StaffAccountStatus,
} from "@/lib/staff/representatives";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * Lifecycle controls for the accounts below you.
 *
 * Who may touch whom, and nothing wider:
 *   * an administrator manages representatives;
 *   * the owner manages representatives and administrators;
 *   * nobody manages the owner, and nobody manages themselves — a mistake
 *     there locks the person making it out of the CRM.
 *
 * PATCH moves an account between ativo / inativo / arquivado. DELETE destroys
 * it for good and is the owner's alone: archiving is the reversible answer,
 * and it is what the interface offers first.
 *
 * Models are deliberately absent from this route: their status is the roster
 * flag on the models row (/api/models/status), which carries over to
 * profiles.active through trg_sync_profile_active_from_model. Writing
 * profiles.active for a model from here would put the two columns back out of
 * step.
 */

type ManageableRole = Extract<
  ManagementRole,
  "representative" | "administrator"
>;

type PatchBody = {
  status?: string;
};

const VALID_STATUSES: StaffAccountStatus[] = ["active", "inactive", "archived"];

type Actor = {
  id: string;
  fullName: string | null;
  role: ManagementRole;
};

type Target = {
  id: string;
  full_name: string | null;
  role: ManageableRole;
  active: boolean | null;
  archived_at: string | null;
};

type Authorized = {
  ok: true;
  actor: Actor;
  target: Target;
};

type Denied = { ok: false; response: NextResponse };

async function authorize(userId: string): Promise<Authorized | Denied> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      ),
    };
  }

  const { data: actorRow, error: actorError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError || !actorRow || !actorRow.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Perfil inválido." },
        { status: 403 },
      ),
    };
  }

  const actorRole = actorRow.role as ManagementRole;

  if (!isStaffRole(actorRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sem permissão." }, { status: 403 }),
    };
  }

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "O ID da conta é obrigatório." },
        { status: 400 },
      ),
    };
  }

  if (userId === actorRow.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Você não pode alterar a sua própria conta por aqui." },
        { status: 403 },
      ),
    };
  }

  // The lifecycle columns may not be on the database yet; fall back so the
  // route still answers with a clear message instead of a 500.
  const extended = await supabase
    .from("profiles")
    .select("id, full_name, role, active, archived_at")
    .eq("id", userId)
    .maybeSingle();

  const targetRow = extended.error
    ? (
        await supabase
          .from("profiles")
          .select("id, full_name, role, active")
          .eq("id", userId)
          .maybeSingle()
      ).data
    : extended.data;

  if (!targetRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Conta não encontrada." },
        { status: 404 },
      ),
    };
  }

  const targetRole = targetRow.role as ManagementRole;

  const manageable =
    targetRole === "representative" ||
    (targetRole === "administrator" && actorRole === "owner");

  if (!manageable) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            targetRole === "model"
              ? "Use o status da modelo na lista de modelos."
              : "Você não tem permissão para gerenciar esta conta.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    actor: {
      id: actorRow.id as string,
      fullName: actorRow.full_name as string | null,
      role: actorRole,
    },
    target: {
      id: targetRow.id as string,
      full_name: targetRow.full_name as string | null,
      role: targetRole as ManageableRole,
      active: (targetRow.active as boolean | null) ?? null,
      archived_at:
        ((targetRow as { archived_at?: string | null }).archived_at ?? null) as
          | string
          | null,
    },
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const auth = await authorize(userId);

  if (!auth.ok) {
    return auth.response;
  }

  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const status = body.status as StaffAccountStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Informe um status válido: ativo, inativo ou arquivado." },
      { status: 400 },
    );
  }

  const previousStatus = accountStatus(auth.target);

  if (previousStatus === status) {
    return NextResponse.json({
      success: true,
      status,
      message: "Nenhuma alteração — a conta já está nesse status.",
    });
  }

  const admin = createAdminClient();

  const columns = statusColumns(status);

  const { error: updateError } = await admin
    .from("profiles")
    .update(columns)
    .eq("id", auth.target.id);

  if (updateError) {
    console.error("Erro ao alterar o status da conta:", updateError);

    // 42703 = the lifecycle columns are not on the database yet.
    return NextResponse.json(
      {
        error:
          updateError.code === "42703"
            ? "O banco ainda não tem a coluna de arquivamento. Rode a migração de ciclo de vida e tente de novo."
            : "Não foi possível alterar o status da conta.",
      },
      { status: updateError.code === "42703" ? 409 : 500 },
    );
  }

  // Losing access has to end the sessions the account is already holding,
  // otherwise "inativo" only takes effect at the next login — the one moment
  // it is not needed.
  if (!columns.active) {
    const { error: signOutError } = await admin.rpc("force_sign_out_user", {
      target_user: auth.target.id,
    });

    if (signOutError) {
      console.error("Erro ao encerrar as sessões da conta:", signOutError);
    }
  }

  await logStaffAudit(admin, {
    action: "account_status_changed",
    actor: auth.actor,
    targetType: auth.target.role,
    targetId: auth.target.id,
    targetName: auth.target.full_name,
    previousValue: STAFF_STATUS_LABELS[previousStatus],
    newValue: STAFF_STATUS_LABELS[status],
  });

  const name = auth.target.full_name?.trim() || "A conta";

  const messages: Record<StaffAccountStatus, string> = {
    active: `${name} foi ativada e pode entrar no sistema.`,
    inactive: `${name} foi desativada e suas sessões foram encerradas.`,
    archived: `${name} foi arquivada. O histórico e as atribuições foram mantidos.`,
  };

  return NextResponse.json({
    success: true,
    status,
    message: messages[status],
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const auth = await authorize(userId);

  if (!auth.ok) {
    return auth.response;
  }

  // Archiving is reversible and keeps every record attributable; permanent
  // deletion is not, so it stops with the owner.
  if (auth.actor.role !== "owner") {
    return NextResponse.json(
      {
        error:
          "Somente o proprietário pode excluir uma conta em definitivo. Arquive a conta para retirá-la do sistema.",
      },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // Her models are not deleted with her — they are left unassigned, and the
  // caller is told how many need a new representative.
  //
  // The assignment is cleared EXPLICITLY rather than left to a cascade:
  // production carries no foreign key on models.representative_id (only
  // profile_id and created_by have one), so a delete there leaves the column
  // pointing at an account that no longer exists.
  const { count: assignedModels } = await admin
    .from("models")
    .select("id", { count: "exact", head: true })
    .eq("representative_id", auth.target.id);

  const { error: unassignError } = await admin
    .from("models")
    .update({ representative_id: null })
    .eq("representative_id", auth.target.id);

  if (unassignError) {
    console.error(
      "Erro ao desvincular as modelos do representante:",
      unassignError,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível desvincular as modelos desta conta. Nada foi excluído.",
      },
      { status: 500 },
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", auth.target.id);

  if (profileError) {
    console.error("Erro ao excluir o perfil:", profileError);

    return NextResponse.json(
      { error: "Não foi possível excluir a conta." },
      { status: 500 },
    );
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(
    auth.target.id,
  );

  // The profile is already gone, so the account can no longer sign in to
  // anything. A leftover auth record is worth reporting, not worth failing on.
  if (authDeleteError) {
    console.error("Erro ao excluir o login da conta:", authDeleteError);
  }

  const unassigned = assignedModels ?? 0;

  await logStaffAudit(admin, {
    action: "account_deleted",
    actor: auth.actor,
    targetType: auth.target.role,
    targetId: auth.target.id,
    targetName: auth.target.full_name,
    previousValue: STAFF_STATUS_LABELS[accountStatus(auth.target)],
    newValue: "Excluída",
    context: { unassignedModels: unassigned },
  });

  const name = auth.target.full_name?.trim() || "A conta";

  return NextResponse.json({
    success: true,
    unassignedModels: unassigned,
    message:
      unassigned > 0
        ? `${name} foi excluída. ${unassigned} modelo(s) ficaram sem representante.`
        : `${name} foi excluída.`,
  });
}
