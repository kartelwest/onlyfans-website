"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/auth/roles";

export type ReassignState = {
  success: boolean;
  message: string;
};

export async function reassignRepresentative(
  previousState: ReassignState,
  formData: FormData,
): Promise<ReassignState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !isStaffRole(profile.role)) {
    return {
      success: false,
      message: "Apenas a equipe pode reatribuir a representante.",
    };
  }

  const modelId = String(formData.get("modelId") ?? "");
  const representativeId = String(formData.get("representativeId") ?? "");

  if (!modelId) {
    return { success: false, message: "Dados incompletos." };
  }

  const adminSupabase = createAdminClient();

  const { data: currentModel } = await adminSupabase
    .from("models")
    .select("representative_id, display_name")
    .eq("id", modelId)
    .single();

  if (!currentModel) {
    return { success: false, message: "Modelo não encontrado." };
  }

  let newRepresentativeId: string | null = null;
  let newRepresentativeName = "Nenhum";

  if (representativeId) {
    const { data: representative } = await adminSupabase
      .from("profiles")
      .select("id, role, active, status, full_name")
      .eq("id", representativeId)
      .in("role", ["owner", "administrator", "representative"])
      .maybeSingle();

    if (!representative || !representative.active) {
      return { success: false, message: "O representante selecionado não está ativo." };
    }

    if (
      representative.role === "representative" &&
      representative.status !== "ativa"
    ) {
      return { success: false, message: "O representante selecionado não está ativo." };
    }

    newRepresentativeId = representative.id;
    newRepresentativeName = representative.full_name ?? "o novo responsável";
  }

  const { error } = await adminSupabase
    .from("models")
    .update({
      representative_id: newRepresentativeId,
      representative_changed_by: user.id,
      representative_changed_at: new Date().toISOString(),
    })
    .eq("id", modelId);

  if (error) {
    console.error("Erro ao reatribuir representante:", error);

    return {
      success: false,
      message: "Não foi possível atualizar o representante.",
    };
  }

  revalidatePath(`/admin/models/[slug]`, "page");
  revalidatePath("/admin/models");

  const actionLabel = newRepresentativeId ? "atribuído a" : "removido de";

  return {
    success: true,
    message: `Modelo ${actionLabel} ${newRepresentativeName}.`,
  };
}
