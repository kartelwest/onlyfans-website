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
    redirect("/login?returnTo=/admin/socialmediamodels");
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
    const fallbackPath =
      profile.role === "representative"
        ? "/representative"
        : profile.role === "model"
          ? "/area-da-modelo"
          : "/login";
    redirect(fallbackPath);
  }

  return { user: { id: user.id }, role: profile.role as AmpliaAdminRole };
}
