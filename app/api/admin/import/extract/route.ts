import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { extractModelsFromFile } from "@/lib/anthropic/importTool";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const ALLOWED_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 403 });
    }

    const role = profile.role as ManagementRole;

    if (role !== "owner" && role !== "administrator") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Envie um arquivo PDF, JPG ou PNG." },
        { status: 400 },
      );
    }

    if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato não suportado. Envie PDF, JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O limite é 15MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString("base64");

    const result = await extractModelsFromFile(base64Data, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao extrair dados do arquivo:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao processar o arquivo.",
      },
      { status: 500 },
    );
  }
}
