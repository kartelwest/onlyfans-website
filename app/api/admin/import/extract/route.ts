import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { extractApplicantsFromFiles } from "@/lib/anthropic/importTool";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const ALLOWED_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;

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
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Envie ao menos 1 arquivo (PDF, JPG ou PNG)." },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Envie no máximo ${MAX_FILES} arquivos por vez.` },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            error: `Formato não suportado: "${file.name}". Envie PDF, JPG, PNG ou WEBP.`,
          },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `Arquivo muito grande: "${file.name}". O limite é 15MB por arquivo.` },
          { status: 400 },
        );
      }
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());

        return {
          base64Data: buffer.toString("base64"),
          mediaType: file.type,
        };
      }),
    );

    const result = await extractApplicantsFromFiles(uploadedFiles);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao extrair dados dos arquivos:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao processar os arquivos.",
      },
      { status: 500 },
    );
  }
}
