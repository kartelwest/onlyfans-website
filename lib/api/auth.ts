import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import type { ManagementRole } from "@/types/model";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type AuthenticatedProfile = {
  id: string;
  fullName: string;
  role: ManagementRole;
  active: boolean;
};

export type AuthFailure = {
  ok: false;
  response: NextResponse;
};

export type UserAuthSuccess = {
  ok: true;
  user: User;
  supabase: ServerClient;
};

export type ManagementAuthSuccess = UserAuthSuccess & {
  profile: AuthenticatedProfile;
};

type UserAuthMessages = {
  unauthenticated?: string;
};

type ManagementAuthOptions = {
  allowedRoles?: readonly ManagementRole[];
  fullNameFallback?: string;
  messages?: {
    unauthenticated?: string;
    inactiveProfile?: string;
    forbidden?: string;
  };
};

/** Builds a JSON error response with the shape used across the API routes. */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Resolves the currently authenticated Supabase user for a route handler.
 * Returns the shared server client so callers can reuse the same session.
 */
export async function authenticateUser(
  messages: UserAuthMessages = {},
): Promise<UserAuthSuccess | AuthFailure> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: jsonError(
        messages.unauthenticated ?? "Não autenticado.",
        401,
      ),
    };
  }

  return { ok: true, user, supabase };
}

/**
 * Authenticates the request and loads the caller's management profile,
 * enforcing that it is active and (optionally) has one of `allowedRoles`.
 */
export async function authenticateManagementRequest(
  options: ManagementAuthOptions = {},
): Promise<ManagementAuthSuccess | AuthFailure> {
  const { allowedRoles, fullNameFallback = "", messages } = options;

  const auth = await authenticateUser({
    unauthenticated: messages?.unauthenticated,
  });

  if (!auth.ok) {
    return auth;
  }

  const { user, supabase } = auth;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return {
      ok: false,
      response: jsonError(
        messages?.inactiveProfile ?? "Perfil inválido.",
        403,
      ),
    };
  }

  const role = profile.role as ManagementRole;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      ok: false,
      response: jsonError(
        messages?.forbidden ?? "Sem permissão.",
        403,
      ),
    };
  }

  return {
    ok: true,
    user,
    supabase,
    profile: {
      id: profile.id as string,
      fullName: (profile.full_name as string | null) ?? fullNameFallback,
      role,
      active: profile.active as boolean,
    },
  };
}
