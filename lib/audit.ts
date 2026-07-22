import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ManagementRole } from "@/types/model";

type AuditEntry = {
  modelId: string;
  actorId: string;
  actorName: string;
  actorRole: ManagementRole;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("model_audit_log").insert({
    model_id: entry.modelId,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    actor_role: entry.actorRole,
    field: entry.field,
    old_value: entry.oldValue,
    new_value: entry.newValue,
  });

  if (error) {
    console.error("Erro ao gravar log de auditoria:", error);
  }
}
