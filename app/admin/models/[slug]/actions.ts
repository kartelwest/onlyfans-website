"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

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
  // Resolved from the caller's cookie/profile, exactly as a page would — a
  // server action runs inside the request, so it knows who is reading it.
  const t = await getTranslations("admin.reassign.messages");

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
      message: t("staffOnly"),
    };
  }

  const modelId = String(formData.get("modelId") ?? "");
  const representativeId = String(formData.get("representativeId") ?? "");

  if (!modelId) {
    return { success: false, message: t("incompleteData") };
  }

  const adminSupabase = createAdminClient();

  const { data: currentModel } = await adminSupabase
    .from("models")
    .select("representative_id, display_name")
    .eq("id", modelId)
    .single();

  if (!currentModel) {
    return { success: false, message: t("modelNotFound") };
  }

  let newRepresentativeId: string | null = null;
  let newRepresentativeName = t("none");

  if (representativeId) {
    const { data: representative } = await adminSupabase
      .from("profiles")
      .select("id, role, active, status, full_name")
      .eq("id", representativeId)
      .in("role", ["owner", "administrator", "representative"])
      .maybeSingle();

    if (!representative || !representative.active) {
      return { success: false, message: t("representativeInactive") };
    }

    if (
      representative.role === "representative" &&
      representative.status !== "ativa"
    ) {
      return { success: false, message: t("representativeInactive") };
    }

    newRepresentativeId = representative.id;
    // A person's name, never translated. The fallback is ours.
    newRepresentativeName = representative.full_name ?? t("theNewOwner");
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
    console.error("Failed to reassign representative:", error);

    return {
      success: false,
      message: t("updateFailed"),
    };
  }

  revalidatePath(`/admin/models/[slug]`, "page");
  revalidatePath("/admin/models");

  return {
    success: true,
    message: newRepresentativeId
      ? t("assigned", { name: newRepresentativeName })
      : t("removed", { name: newRepresentativeName }),
  };
}
