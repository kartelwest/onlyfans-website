"use server";

import { revalidatePath } from "next/cache";
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

async function requireStaff(): Promise<ActionResult | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sua sessão expirou." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active, status")
    .eq("id", user.id)
    .single();

  if (!profile?.active || (profile.role !== "owner" && profile.role !== "administrator")) {
    return { success: false, message: "Você não tem permissão." };
  }

  return null;
}

export async function updateRepresentativeStatus(
  previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staffCheck = await requireStaff();

  if (staffCheck) {
    return staffCheck;
  }

  const representativeId = String(formData.get("representativeId") ?? "");
  const status = String(formData.get("status") ?? "") as AllowedStatus;

  if (!representativeId || !ALLOWED_STATUSES.includes(status)) {
    return { success: false, message: "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", representativeId)
    .single();

  if (target?.role !== "representative") {
    return { success: false, message: "O perfil selecionado não é um representante." };
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
      message: "Não foi possível atualizar o status.",
    };
  }

  revalidatePath("/admin/representatives");

  return {
    success: true,
    message: `Representante ${status === "ativa" ? "ativado" : status === "inativa" ? "inativado" : "arquivado"} com sucesso.`,
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
  const staffCheck = await requireStaff();

  if (staffCheck) {
    return staffCheck;
  }

  const representativeId = String(formData.get("representativeId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!representativeId) {
    return { success: false, message: "Dados inválidos." };
  }

  if (!fullName) {
    return { success: false, message: "O nome é obrigatório." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Informe um e-mail válido." };
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
      message: "O perfil selecionado não é um representante.",
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

    return { success: false, message: "Não foi possível salvar as alterações." };
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

  return { success: true, message: "Dados atualizados." };
}

export async function deleteRepresentative(
  previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staffCheck = await requireStaff();

  if (staffCheck) {
    return staffCheck;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sua sessão expirou." };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (actor?.role !== "owner") {
    return { success: false, message: "Apenas o proprietário pode excluir permanentemente." };
  }

  const representativeId = String(formData.get("representativeId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!representativeId || confirmation !== "EXCLUIR") {
    return { success: false, message: "Confirmação inválida." };
  }

  const adminSupabase = createAdminClient();

  const { data: target } = await adminSupabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", representativeId)
    .single();

  if (target?.role !== "representative") {
    return { success: false, message: "O perfil selecionado não é um representante." };
  }

  const { data: assignedModels } = await adminSupabase
    .from("models")
    .select("id")
    .eq("representative_id", representativeId)
    .limit(1);

  if ((assignedModels ?? []).length > 0) {
    return {
      success: false,
      message:
        "Este representante ainda tem modelos atribuídos. Reatribua ou exclua os modelos antes de excluí-lo.",
    };
  }

  // Auth deletion must happen before the profile row is removed.
  const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(
    representativeId,
  );

  if (authDeleteError) {
    console.error("Erro ao excluir usuário de autenticação:", authDeleteError);

    return {
      success: false,
      message: "Não foi possível excluir a conta de autenticação.",
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
      message: "Não foi possível remover o perfil do representante.",
    };
  }

  revalidatePath("/admin/representatives");

  return {
    success: true,
    message: `Representante ${target.full_name ?? ""} excluído permanentemente.`,
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
