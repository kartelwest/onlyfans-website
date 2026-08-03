import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The three states a staff account can be in, derived from two columns rather
 * than stored in a third — see
 * supabase/migrations/20260803010000_representative_lifecycle_and_staff_audit.sql.
 *
 *   Ativo     active = true,  archived_at null
 *   Inativo   active = false, archived_at null
 *   Arquivado active = false, archived_at set
 *
 * Deriving it means the status can never disagree with whether the account can
 * actually log in, because profiles.active is what the login gates read.
 */
export type StaffAccountStatus = "active" | "inactive" | "archived";

export const STAFF_STATUS_LABELS: Record<StaffAccountStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado",
};

export const STAFF_STATUS_BADGE: Record<StaffAccountStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  inactive: "bg-white/5 text-white/60 ring-white/15",
  archived: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
};

export function accountStatus(profile: {
  active: boolean | null;
  archived_at?: string | null;
}): StaffAccountStatus {
  if (profile.archived_at) {
    return "archived";
  }

  return profile.active ? "active" : "inactive";
}

/** What a status change writes. Archiving always carries the deactivation. */
export function statusColumns(status: StaffAccountStatus): {
  active: boolean;
  archived_at: string | null;
} {
  switch (status) {
    case "active":
      return { active: true, archived_at: null };
    case "inactive":
      return { active: false, archived_at: null };
    case "archived":
      return { active: false, archived_at: new Date().toISOString() };
  }
}

export type StaffProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  active: boolean | null;
  archived_at: string | null;
  phone: string | null;
  last_login_at: string | null;
  created_at: string | null;
};

const EXTENDED_COLUMNS =
  "id, full_name, email, role, active, archived_at, phone, last_login_at, created_at";

const BASE_COLUMNS = "id, full_name, email, role, active, created_at";

/**
 * Loads staff profiles of one role.
 *
 * Falls back to the pre-lifecycle column list when the new columns are not on
 * the database yet (undefined_column, 42703). The screens then behave exactly
 * as they did before — active/inactive only — instead of the whole page
 * failing because a deploy landed ahead of its migration.
 */
export async function loadStaffProfiles(
  supabase: SupabaseClient,
  role: "representative" | "administrator",
): Promise<{ profiles: StaffProfileRow[]; lifecycleReady: boolean }> {
  const extended = await supabase
    .from("profiles")
    .select(EXTENDED_COLUMNS)
    .eq("role", role)
    .order("full_name", { ascending: true });

  if (!extended.error) {
    return {
      profiles: (extended.data ?? []) as unknown as StaffProfileRow[],
      lifecycleReady: true,
    };
  }

  if (extended.error.code !== "42703") {
    console.error("Erro ao carregar contas de staff:", extended.error);
  }

  const base = await supabase
    .from("profiles")
    .select(BASE_COLUMNS)
    .eq("role", role)
    .order("full_name", { ascending: true });

  if (base.error) {
    console.error("Erro ao carregar contas de staff:", base.error);

    return { profiles: [], lifecycleReady: false };
  }

  const profiles = (base.data ?? []).map((row) => ({
    ...(row as Record<string, unknown>),
    archived_at: null,
    phone: null,
    last_login_at: null,
  })) as unknown as StaffProfileRow[];

  return { profiles, lifecycleReady: false };
}
