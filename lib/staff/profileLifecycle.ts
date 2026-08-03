import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reading profiles.status on a database that may not have it yet.
 *
 * The lifecycle column arrives with
 * supabase/migrations/20260803000001_representative_system.sql. Code that
 * selects it against a database where the migration has not run gets
 * undefined_column (42703) for the WHOLE query — not a null field — so the row
 * comes back empty and every guard reading it turns into "sem permissão". That
 * is how a deploy landing ahead of its migration locks real representatives
 * out of their own back office.
 *
 * These helpers ask for the column, and on 42703 fall back to the columns that
 * have always existed, deriving the status from profiles.active. The fallback
 * stops being reachable the moment the migration runs.
 */

const UNDEFINED_COLUMN = "42703";

export type LifecycleStatus = "ativa" | "inativa" | "arquivada";

export function statusFromActive(active: boolean | null | undefined) {
  return active ? "ativa" : "inativa";
}

/**
 * One profile by id, with `status` guaranteed present.
 *
 * `columns` is the caller's own list, without status — it is appended here.
 */
export async function loadProfileWithStatus(
  supabase: SupabaseClient,
  userId: string,
  columns: string,
): Promise<(Record<string, unknown> & { status: string }) | null> {
  const extended = await supabase
    .from("profiles")
    .select(`${columns}, status`)
    .eq("id", userId)
    .maybeSingle();

  if (!extended.error) {
    const row = extended.data as unknown as Record<string, unknown> | null;

    if (!row) {
      return null;
    }

    return {
      ...row,
      status:
        (row.status as string | null) ??
        statusFromActive(row.active as boolean | null),
    };
  }

  if (extended.error.code !== UNDEFINED_COLUMN) {
    console.error("Erro ao carregar o perfil:", extended.error);
    return null;
  }

  const base = await supabase
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();

  if (base.error || !base.data) {
    return null;
  }

  const row = base.data as unknown as Record<string, unknown>;

  return { ...row, status: statusFromActive(row.active as boolean | null) };
}
