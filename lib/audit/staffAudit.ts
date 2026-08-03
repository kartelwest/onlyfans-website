import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ManagementRole } from "@/types/model";

/**
 * The account-level audit trail (public.staff_audit_log).
 *
 * model_audit_history answers "what happened to this model". This answers
 * "what did this member of staff do" — archiving a representative, deleting an
 * account, opening a view-as session — where there is no single model to hang
 * the row from.
 *
 * Every write goes through the service-role client from a route that has
 * already authorized the actor: the table grants `authenticated` SELECT only,
 * so a session cannot forge an entry.
 */

export type StaffAuditEntry = {
  action: string;
  actor: { id: string; fullName: string | null; role: ManagementRole };
  targetType: "representative" | "administrator" | "model" | "note" | "account";
  targetId?: string | null;
  targetName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  context?: Record<string, unknown>;
};

/**
 * Best-effort by design: an audit row that cannot be written must never take
 * the action itself down with it. Failures are logged for the server operator
 * and swallowed for the caller.
 */
export async function logStaffAudit(
  admin: SupabaseClient,
  entry: StaffAuditEntry,
): Promise<void> {
  const { error } = await admin.from("staff_audit_log").insert({
    action: entry.action,
    actor_id: entry.actor.id,
    actor_name: entry.actor.fullName?.trim() || "Usuário",
    actor_role: entry.actor.role,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    target_name: entry.targetName ?? null,
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    context: entry.context ?? {},
  });

  if (error) {
    console.error("Falha ao registrar no histórico de staff:", error);
  }
}
