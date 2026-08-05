"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemAuditEntry } from "@/lib/audit/auditLogger";

type ActionResult = {
  success: boolean;
  message: string;
};

/**
 * Permanent deletion of an administrator account.
 *
 * The capability already existed — it was buried behind "Manage account" on
 * /owner/users/[id], two clicks from the list where administrators are
 * actually looked at, and wearing a neutral label. Representatives had a red
 * Delete button right on the row. Same power, two presentations, and the
 * asymmetry read as a missing permission.
 *
 * This is the representative action's twin, with the same three refusals:
 *
 *   OWNER ONLY. Checked here against the database, never against the request,
 *   and independently enforced by the profiles_delete RLS policy
 *   (`using ( public.is_owner() )`). An administrator cannot delete a peer,
 *   and — because the target must be an administrator — nobody can delete an
 *   owner through this path at all. That last rule is what stops an owner
 *   deleting themselves out of their own business.
 *
 *   NOT WHILE SHE HOLDS MODELS. models.representative_id points at a profile
 *   and is ON DELETE SET NULL, and an ADMINISTRATOR can be assigned models
 *   exactly like a representative can — in production today, most models are
 *   assigned to an administrator or to the owner. Dropping the row would
 *   quietly unassign every one of them with nothing on screen saying so. So
 *   the count is checked first and deletion is refused until they are moved.
 *
 *   NOT WITHOUT A RECORD. The audit row is written after the account is gone
 *   and survives it: system_audit_log.target_id carries no foreign key, and
 *   actor_id is ON DELETE SET NULL.
 *
 * On the Portuguese left in this file: `message` values are translated because
 * the owner reads them. The `summary` written into system_audit_log is not,
 * for the reason set out at the top of app/admin/representatives/actions.ts —
 * a historical record should not change language with its reader.
 */
export async function deleteAdministrator(
  previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("admin.administrators.actions");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: t("sessionExpired") };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!actor?.active) {
    return { success: false, message: t("notPermitted") };
  }

  if (actor.role !== "owner") {
    return { success: false, message: t("ownerOnlyDelete") };
  }

  const administratorId = String(formData.get("administratorId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  // Matched verbatim, so it is the same literal whatever language the owner
  // reads in. The phrase shown in the dialog IS translated; the client sends
  // this fixed value once the typed phrase satisfies it.
  if (!administratorId || confirmation !== "EXCLUIR") {
    return { success: false, message: t("invalidConfirmation") };
  }

  if (administratorId === actor.id) {
    return { success: false, message: t("cannotDeleteSelf") };
  }

  const adminSupabase = createAdminClient();

  const { data: target } = await adminSupabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", administratorId)
    .single();

  if (target?.role !== "administrator") {
    return { success: false, message: t("notAnAdministrator") };
  }

  const { data: assignedModels } = await adminSupabase
    .from("models")
    .select("id")
    .eq("representative_id", administratorId);

  const assignedCount = (assignedModels ?? []).length;

  if (assignedCount > 0) {
    return {
      success: false,
      message: t("stillHasModels", { count: assignedCount }),
    };
  }

  // Auth first: if the profile row went first and this failed, the login would
  // outlive the account it belongs to.
  const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(
    administratorId,
  );

  if (authDeleteError) {
    console.error("Failed to delete the auth user:", authDeleteError);

    return { success: false, message: t("authDeleteFailed") };
  }

  const { error: profileDeleteError } = await adminSupabase
    .from("profiles")
    .delete()
    .eq("id", administratorId);

  if (profileDeleteError) {
    console.error("Failed to delete the profile:", profileDeleteError);

    return { success: false, message: t("profileDeleteFailed") };
  }

  await logSystemAuditEntry(supabase, {
    action: "administrator_deleted",
    targetType: "administrator",
    targetId: administratorId,
    targetName: target.full_name,
    actor: {
      id: actor.id,
      fullName: actor.full_name ?? "Usuário",
      role: "owner",
    },
    previousValue: {
      full_name: target.full_name,
      email: target.email,
      assigned_models: 0,
    },
    newValue: null,
    source: "admin/models",
    summary: `${actor.full_name ?? "Usuário"} excluiu permanentemente o administrador ${
      target.full_name ?? "sem nome"
    }.`,
  });

  revalidatePath("/admin/models");
  revalidatePath("/owner/users");

  return {
    success: true,
    message: t("deleted", { name: target.full_name ?? "" }),
  };
}
