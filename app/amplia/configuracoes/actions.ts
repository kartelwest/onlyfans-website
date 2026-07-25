"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SettingsState = {
  success: boolean;
  message: string;
};

export async function updateAmpliaSettingsAction(
  _previousState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const moduleCodeName = String(
    formData.get("moduleCodeName") ?? "",
  ).trim();

  const displayName = String(formData.get("displayName") ?? "").trim();

  const featureXEnabled = formData.get("featureXEnabled") === "on";

  if (!moduleCodeName || !displayName) {
    return {
      success: false,
      message: "Preencha o nome interno e o nome de exibição.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sua sessão expirou. Entre novamente." };
  }

  // Defense in depth: RLS already restricts app_settings writes to owner,
  // but check explicitly here too so the error message is meaningful.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active || profile.role !== "owner") {
    return {
      success: false,
      message:
        "Somente o proprietário pode alterar as configurações do Amplia.",
    };
  }

  const updates = [
    { key: "amplia_module_code_name", value: moduleCodeName },
    { key: "amplia_display_name", value: displayName },
    { key: "feature_x_enabled", value: featureXEnabled },
  ];

  const { error } = await supabase.from("app_settings").upsert(updates);

  if (error) {
    return {
      success: false,
      message: `Não foi possível salvar: ${error.message}`,
    };
  }

  revalidatePath("/amplia", "layout");

  return { success: true, message: "Configurações salvas com sucesso." };
}
