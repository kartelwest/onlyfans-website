import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
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
    .maybeSingle();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  switch (profile.role) {
    case "owner":
      redirect("/admin/models");
    case "administrator":
      redirect("/admin/models");
    case "representative":
      redirect("/representative");
    case "model":
      redirect("/area-da-modelo");
    default:
      redirect("/login");
  }
}
