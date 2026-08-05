import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The representative lifecycle, as stored by
 * supabase/migrations/20260803000001_representative_system.sql:
 * profiles.status holds 'ativa' | 'inativa' | 'arquivada', and a trigger keeps
 * profiles.active in step for representatives (active = status = 'ativa').
 *
 * This module is the read side of that column for the screens that only need
 * to show it — the writes live in app/admin/representatives/actions.ts.
 */
export type StaffAccountStatus = "ativa" | "inativa" | "arquivada";

export const STAFF_STATUS_LABELS: Record<StaffAccountStatus, string> = {
  ativa: "Ativo",
  inativa: "Inativo",
  arquivada: "Arquivado",
};

export const STAFF_STATUS_BADGE: Record<StaffAccountStatus, string> = {
  ativa: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  inativa: "bg-white/5 text-white/60 ring-white/15",
  arquivada: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
};

export function accountStatus(profile: {
  active: boolean | null;
  status?: string | null;
}): StaffAccountStatus {
  if (
    profile.status === "ativa" ||
    profile.status === "inativa" ||
    profile.status === "arquivada"
  ) {
    return profile.status;
  }

  // A database without the lifecycle column yet still has the flag every login
  // gate reads, so the badge stays truthful instead of blank.
  return profile.active ? "ativa" : "inativa";
}

export type StaffProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  active: boolean | null;
  status: string | null;
  phone: string | null;
  last_login_at: string | null;
  created_at: string | null;
};

const EXTENDED_COLUMNS =
  "id, full_name, email, role, active, status, phone, last_login_at, created_at";

const BASE_COLUMNS = "id, full_name, email, role, active, created_at";

/**
 * Loads staff profiles of one role.
 *
 * Falls back to the pre-lifecycle column list when the new columns are not on
 * the database yet (undefined_column, 42703). The screens then behave as they
 * did before — active/inactive only — instead of the whole page failing
 * because a deploy landed ahead of its migration.
 */
export async function loadStaffProfiles(
  supabase: SupabaseClient,
  role: "owner" | "representative" | "administrator",
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
    status: null,
    phone: null,
    last_login_at: null,
  })) as unknown as StaffProfileRow[];

  return { profiles, lifecycleReady: false };
}
