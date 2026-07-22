import "server-only";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

type AuthenticatedProfile = {
  id: string;
  fullName: string;
  role: ManagementRole;
};

type AuthResult =
  | { ok: true; profile: AuthenticatedProfile }
  | { ok: false; response: NextResponse };

type AccessResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export async function getAuthenticatedProfile(): Promise<AuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Seu perfil não está ativo." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    profile: {
      id: profile.id,
      fullName: profile.full_name || "Usuário",
      role: profile.role as ManagementRole,
    },
  };
}

export async function verifyModelAccess(
  modelId: string,
  profile: AuthenticatedProfile,
): Promise<AccessResult> {
  const supabase = await createClient();

  if (profile.role === "owner" || profile.role === "administrator") {
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError || !model) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "A modelo solicitada não foi encontrada." },
          { status: 404 },
        ),
      };
    }

    return { ok: true };
  }

  if (profile.role === "representative") {
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id")
      .eq("id", modelId)
      .eq("representative_id", profile.id)
      .maybeSingle();

    if (modelError || !model) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Você não tem acesso a esta modelo." },
          { status: 403 },
        ),
      };
    }

    return { ok: true };
  }

  if (profile.role === "model") {
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id")
      .eq("id", modelId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (modelError || !model) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Você não tem acesso a esta modelo." },
          { status: 403 },
        ),
      };
    }

    return { ok: true };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Sem permissão." },
      { status: 403 },
    ),
  };
}

export async function requireStaff(
  profile: AuthenticatedProfile,
): Promise<AccessResult> {
  if (profile.role !== "owner" && profile.role !== "administrator") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}

export type { AuthenticatedProfile };
