import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAmpliaAccess(): Promise<{
  user: { id: string };
  role: string;
}> {
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

  if (!profile || !profile.active) {
    redirect("/login");
  }

  if (!["owner", "administrator", "brand_manager", "content_manager", "analyst", "reviewer"].includes(profile.role)) {
    redirect("/admin/models");
  }

  return { user: { id: user.id }, role: profile.role };
}
