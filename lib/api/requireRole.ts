import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isStaffRole, STAFF_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import type { ManagementRole } from "@/types/model";

export { isStaffRole };

// Every route handler in this feature enforces its own permissions in addition
// to RLS — the two layers are independent on purpose, so a policy that is ever
// relaxed by mistake does not silently open an endpoint.

export type RouteProfile = {
  id: string;
  fullName: string;
  role: ManagementRole;
};

export type RouteAuth =
  | { ok: true; supabase: SupabaseClient; profile: RouteProfile }
  | { ok: false; response: NextResponse };

export async function authenticate(): Promise<RouteAuth> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Perfil inválido." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    supabase,
    profile: {
      id: profile.id as string,
      fullName: (profile.full_name as string | null) || "Usuário",
      role: profile.role as ManagementRole,
    },
  };
}

/** Owner or administrator. Representatives and models are rejected with 403. */
export async function requireStaff(): Promise<RouteAuth> {
  const auth = await authenticate();

  if (!auth.ok) {
    return auth;
  }

  if (!STAFF_ROLES.includes(auth.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      ),
    };
  }

  return auth;
}

/**
 * Turns a Postgres error raised inside one of the ledger RPCs into the status
 * the caller deserves. The routes pre-check the same conditions, so this only
 * fires when the database is the one saying no.
 */
export function rpcErrorResponse(
  error: { code?: string; message?: string },
  fallbackMessage: string,
): NextResponse {
  if (error.code === "42501") {
    return NextResponse.json(
      { error: error.message || "Sem permissão." },
      { status: 403 },
    );
  }

  if (error.code === "P0002") {
    return NextResponse.json(
      { error: "Lançamento não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export type ModelAccess =
  | { ok: true; expensesEnabled: boolean }
  | { ok: false; response: NextResponse };

/**
 * Confirms the caller may look at this model at all: staff anywhere, a rep on
 * her assigned models, a model on her own record.
 */
export async function requireModelAccess(
  supabase: SupabaseClient,
  profile: RouteProfile,
  modelId: string,
): Promise<ModelAccess> {
  let query = supabase
    .from("models")
    .select("id, expenses_enabled")
    .eq("id", modelId);

  if (profile.role === "representative") {
    query = query.eq("representative_id", profile.id);
  } else if (profile.role === "model") {
    query = query.eq("profile_id", profile.id);
  } else if (!isStaffRole(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      ),
    };
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Modelo não encontrada." },
        { status: 404 },
      ),
    };
  }

  return { ok: true, expensesEnabled: data.expenses_enabled === true };
}
