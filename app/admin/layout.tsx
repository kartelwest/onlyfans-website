import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

import AdminHeader from "./AdminHeader";

/**
 * The role is read here, once, so the header knows which tabs to draw.
 *
 * This is not an access check. Every page under /admin re-reads the role and
 * redirects on its own, and the database enforces the same rules a third time —
 * a layout cannot redirect on behalf of the page it wraps, so it must not
 * pretend to.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: ManagementRole | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.active) {
      role = profile.role as ManagementRole;
    }
  }

  return (
    <div className="min-h-screen bg-[#08080a]">
      <AdminHeader role={role} />
      {children}
    </div>
  );
}
