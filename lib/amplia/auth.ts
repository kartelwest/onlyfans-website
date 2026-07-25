import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AmpliaSession } from "@/types/amplia";

/**
 * Amplia is owner/administrator only (spec section 9.2). RLS on every Amplia
 * table already enforces this at the data layer via is_management() — this
 * is the route-layer check, mirroring the per-page pattern used everywhere
 * else in this app (see app/admin/models/page.tsx, app/representative/page.tsx).
 */
export async function requireAmpliaAccess(): Promise<AmpliaSession> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  if (profile.role === "representative") {
    redirect("/representative");
  }

  if (profile.role === "model") {
    redirect("/area-da-modelo");
  }

  if (profile.role !== "owner" && profile.role !== "administrator") {
    redirect("/login");
  }

  return {
    userId: user.id,
    fullName: profile.full_name ?? "",
    role: profile.role,
  };
}
