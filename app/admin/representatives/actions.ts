"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemAuditEntry } from "@/lib/audit/auditLogger";

type ActionResult = {
  success: boolean;
  message: string;
};

type AllowedStatus = "ativa" | "inativa" | "arquivada";

const ALLOWED_STATUSES: AllowedStatus[] = ["ativa", "inativa", "arquivada"];

/**
 * A NOTE ON THE PORTUGUESE LEFT IN THIS FILE.
 *
 * Every `message` returned to the caller is translated — those are UI, and the
 * admin reads them. The `summary` strings and the `"Usuário"` actor fallback
 * are NOT, and must not be: they are written INTO `system_audit_log` and read
 * back later as a historical record. Translating at write time would leave the
 * log in whichever language the actor happened to be using, so the same action
 * would read two ways depending on who performed it — and the entry would no
 * longer match what that person actually saw on screen.
 *
 * If the audit log should ever follow the reader, the fix is to store a code
 * plus parameters and render the sentence at read time. That is a schema
 * change, not an i18n change.
 */

async function requireStaff(): Promise<ActionResult | null> {
  const t = await getTranslations("admin.representatives.actions");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: t("sessionExpired") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active, status")
    .eq("id", user.id)
    .single();

  if (!profile?.active || (profile.role !== "owner" && profile.role !== "administrator")) {
    return { success: false, message: t("notPermitted") };
  }

  return null;
}

export async function updateRepresentativeStatus(
  previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("admin.representatives.actions");

  const staffCheck = await requireStaff();

  if (staffCheck) {
    return staffCheck;
  }

  const representativeId = String(formData.get("representativeId") ?? "");
  const status = String(formData.get("status") ?? "") as AllowedStatus;

  if (!representativeId || !ALLOWED_STATUSES.includes(status)) {
    return { success: false, message: t("invalidData") };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", representativeId)
    .single();

  if (target?.role !== "representative") {
    return { success: false, message: t("notARepresentative") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", representativeId)
    .eq("role", "representative");

  if (error) {
    console.error("Erro ao atualizar status do representante:", error);

    return {
      success: false,
      message: t("statusUpdateFailed"),
    };
  }

  revalidatePath("/admin/representatives");

  return {
    success: true,
    message:
      status === "ativa"
        ? t("activated")
        : status === "inativa"
          ? t("deactivated")
          : t("archived"),
  };
}

/**
 * Name, e-mail and phone on a representative's profile.
 *
 * The name is guarded in the database too (manage_profile_columns refuses a
 * full_name change from anyone who is not staff), because it is copied onto
 * every note and audit row this person touches.
 */
export async function updateRepresentativeDetails(
  previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("admin.representatives.actions");

  const staffCheck = await requireStaff();

  if (staffCheck) {
    return staffCheck;
  }

  const representativeId = String(formData.get("representativeId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!representativeId) {
    return { success: false, message: t("invalidData") };
  }

  if (!fullName) {
    return { success: false, message: t("nameRequired") };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: t("invalidEmail") };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .eq("id", representativeId)
    .single();

  if (target?.role !== "representative") {
    return {
      success: false,
      message: t("notARepresentative"),
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      email: email || null,
      phone: phone || null,
    })
    .eq("id", representativeId)
    .eq("role", "representative");

  if (error) {
    console.error("Erro ao atualizar o representante:", error);

    return { success: false, message: t("saveFailed") };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: actor } = user
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single()
    : { data: null };

  if (actor) {
    await logSystemAuditEntry(supabase, {
      action: "representative_details_updated",
      targetType: "representative",
      targetId: representativeId,
      targetName: fullName,
      actor: {
        id: actor.id,
        fullName: actor.full_name ?? "Usuário",
        role: actor.role ?? "administrator",
      },
      previousValue: {
        full_name: target.full_name,
        email: target.email,
        phone: target.phone,
      },
      newValue: { full_name: fullName, email: email || null, phone: phone || null },
      source: "admin/representatives",
      summary: `${actor.full_name ?? "Usuário"} atualizou os dados do representante ${fullName}.`,
    });
  }

  revalidatePath("/admin/representatives");
  revalidatePath(`/admin/representatives/${representativeId}`);

  return { success: true, message: t("detailsUpdated") };
}

export async function deleteRepresentative(
  previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("admin.representatives.actions");

  const staffCheck = await requireStaff();

  if (staffCheck) {
    return staffCheck;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: t("sessionExpired") };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (actor?.role !== "owner") {
    return { success: false, message: t("ownerOnlyDelete") };
  }

  const representativeId = String(formData.get("representativeId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!representativeId || confirmation !== "EXCLUIR") {
    return { success: false, message: t("invalidConfirmation") };
  }

  const adminSupabase = createAdminClient();

  const { data: target } = await adminSupabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", representativeId)
    .single();

  if (target?.role !== "representative") {
    return { success: false, message: t("notARepresentative") };
  }

  // A representative who still holds models is never deleted: dropping the
  // profile row would set models.representative_id to null (ON DELETE SET NULL)
  // and those models would quietly become unassigned, with nothing on screen
  // saying so. Reassignment first, deletion second.
  const { data: assignedModels } = await adminSupabase
    .from("models")
    .select("id, display_name")
    .eq("representative_id", representativeId);

  const assignedCount = (assignedModels ?? []).length;

  if (assignedCount > 0) {
    return {
      success: false,
      message: t("stillHasModels", { count: assignedCount }),
    };
  }

  // Auth deletion must happen before the profile row is removed.
  const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(
    representativeId,
  );

  if (authDeleteError) {
    console.error("Failed to delete the auth user:", authDeleteError);

    return {
      success: false,
      message: t("authDeleteFailed"),
    };
  }

  const { error: profileDeleteError } = await adminSupabase
    .from("profiles")
    .delete()
    .eq("id", representativeId);

  if (profileDeleteError) {
    console.error("Erro ao excluir perfil do representante:", profileDeleteError);

    return {
      success: false,
      message: t("profileDeleteFailed"),
    };
  }

  // The account is gone; the record of its removal is not. system_audit_log
  // holds no foreign key to profiles on target_id, so this row survives the
  // profile it describes — which is the entire point of writing it.
  await logSystemAuditEntry(supabase, {
    action: "representative_deleted",
    targetType: "representative",
    targetId: representativeId,
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
    source: "admin/representatives",
    summary: `${actor.full_name ?? "Usuário"} excluiu permanentemente o representante ${
      target.full_name ?? "sem nome"
    }.`,
  });

  revalidatePath("/admin/representatives");
  revalidatePath("/admin/models");

  return {
    success: true,
    message: t("deleted", { name: target.full_name ?? "" }),
  };
}

export async function viewAsRepresentative(representativeId: string): Promise<void> {
  const staffCheck = await requireStaff();

  if (staffCheck) {
    redirect("/login");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const { data: rep } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, status")
    .eq("id", representativeId)
    .eq("role", "representative")
    .single();

  if (!rep || rep.status !== "ativa" || !rep.active) {
    redirect("/admin/representatives");
  }

  if (actor) {
    await logSystemAuditEntry(supabase, {
      action: "view_as_representative_enter",
      targetType: "representative",
      targetId: rep.id,
      targetName: rep.full_name,
      actor: {
        id: actor.id,
        fullName: actor.full_name ?? "Usuário",
        role: actor.role ?? "administrator",
      },
      source: "admin/representatives",
      summary: `${actor.full_name ?? "Usuário"} entrou na visualização como representante ${rep.full_name ?? ""}.`,
    });
  }

  redirect(`/admin/view-as/representative/${rep.id}`);
}

export async function exitViewAsRepresentative(
  representativeId: string,
  backPath = "/admin/models",
): Promise<void> {
  const staffCheck = await requireStaff();

  if (staffCheck) {
    redirect(backPath);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(backPath);
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const { data: rep } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", representativeId)
    .eq("role", "representative")
    .maybeSingle();

  if (actor) {
    await logSystemAuditEntry(supabase, {
      action: "view_as_representative_exit",
      targetType: "representative",
      targetId: rep?.id ?? representativeId,
      targetName: rep?.full_name,
      actor: {
        id: actor.id,
        fullName: actor.full_name ?? "Usuário",
        role: actor.role ?? "administrator",
      },
      source: "admin/view-as/representative",
      summary: `${actor.full_name ?? "Usuário"} saiu da visualização como representante ${rep?.full_name ?? ""}.`,
    });
  }

  redirect(backPath);
}
