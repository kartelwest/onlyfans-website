import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  getModelImporterAutoSave,
  setModelImporterAutoSave,
} from "@/lib/adminSettings";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

async function requireStaffProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return { error: NextResponse.json({ error: "Perfil inválido." }, { status: 403 }) };
  }

  const role = profile.role as ManagementRole;

  if (role !== "owner" && role !== "administrator") {
    return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }

  return { role };
}

export async function GET() {
  const supabase = await createClient();
  const check = await requireStaffProfile(supabase);

  if ("error" in check) {
    return check.error;
  }

  const autoSave = await getModelImporterAutoSave(supabase);

  return NextResponse.json({ autoSave });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const check = await requireStaffProfile(supabase);

  if ("error" in check) {
    return check.error;
  }

  if (check.role !== "owner") {
    return NextResponse.json(
      { error: "Apenas o proprietário pode alterar esta configuração." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { autoSave?: boolean };

  if (typeof body.autoSave !== "boolean") {
    return NextResponse.json({ error: "autoSave deve ser booleano." }, { status: 400 });
  }

  const result = await setModelImporterAutoSave(supabase, body.autoSave);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ autoSave: body.autoSave });
}
