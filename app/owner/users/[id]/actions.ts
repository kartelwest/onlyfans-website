"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteAccountAction(
  targetId: string,
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ownerProfile, error: ownerError } =
    await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

  if (
    ownerError ||
    !ownerProfile ||
    !ownerProfile.active ||
    ownerProfile.role !== "owner"
  ) {
    redirect("/admin/models");
  }

  const { data: targetProfile, error: targetError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", targetId)
      .single();

  if (targetError || !targetProfile) {
    redirect("/owner/users");
  }

  if (
    targetProfile.role !== "administrator" &&
    targetProfile.role !== "representative"
  ) {
    redirect(`/owner/users/${targetId}`);
  }

  const adminSupabase = createAdminClient();

  await adminSupabase
    .from("profiles")
    .delete()
    .eq("id", targetId);

  await adminSupabase.auth.admin.deleteUser(targetId);

  revalidatePath("/admin/models");
  revalidatePath("/owner/users");

  redirect("/owner/users");
}
