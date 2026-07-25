import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AmpliaAdminRole = "owner" | "administrator";

export async function requireAdminAmpliaAccess(): Promise<{
  user: { id: string };
  role: AmpliaAdminRole;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=/admin/amplia");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  if (profile.role !== "owner" && profile.role !== "administrator") {
    redirect("/admin/models");
  }

  return { user: { id: user.id }, role: profile.role as AmpliaAdminRole };
}
