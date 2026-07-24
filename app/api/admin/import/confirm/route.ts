import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";
import type { ExtractedModel } from "@/lib/anthropic/importTool";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

type ConfirmBody = {
  models?: ExtractedModel[];
};

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

    const body = (await request.json()) as ConfirmBody;

    if (!Array.isArray(body.models) || body.models.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma modelo para salvar." },
        { status: 400 },
      );
    }

    const results: {
      index: number;
      ok: boolean;
      id?: string;
      slug?: string;
      display_name: string;
      error?: string;
    }[] = [];

    for (let index = 0; index < body.models.length; index++) {
      const model = body.models[index];
      const displayName = model.display_name?.trim();

      if (!displayName) {
        results.push({
          index,
          ok: false,
          display_name: "(sem nome)",
          error: "Nome obrigatório.",
        });
        continue;
      }

      try {
        const stageName = model.stage_name?.trim() || null;

        const slug = await createUniqueModelSlug(
          supabase,
          stageName || displayName,
        );

        const modelNumber = await getNextModelNumber(supabase);

        const cityParts = [model.city?.trim(), model.state?.trim()].filter(
          Boolean,
        );

        const insertPayload: Record<string, unknown> = {
          model_number: modelNumber,
          slug,
          display_name: displayName,
          stage_name: stageName,
          status: "candidate",
          active: false,
          latest_note_summary:
            "Criada pelo importador de PDF/imagem (assistente Claude).",
        };

        if (model.birthday?.trim()) {
          insertPayload.birthday = model.birthday.trim();
        }

        if (cityParts.length > 0) {
          insertPayload.city = cityParts.join(", ");
        }

        if (model.country?.trim()) {
          insertPayload.nationality = model.country.trim();
        }

        if (model.email?.trim()) {
          insertPayload.email = model.email.trim().toLowerCase();
        }

        if (model.whatsapp?.trim()) {
          insertPayload.whatsapp = model.whatsapp.trim();
        }

        if (model.instagram?.trim()) {
          insertPayload.instagram = model.instagram.trim();
        }

        if (model.twitter?.trim()) {
          insertPayload.twitter = model.twitter.trim();
        }

        const { data, error } = await supabase
          .from("models")
          .insert(insertPayload)
          .select("id, slug, display_name")
          .single();

        if (error || !data) {
          results.push({
            index,
            ok: false,
            display_name: displayName,
            error: error?.message || "Erro ao salvar.",
          });
          continue;
        }

        results.push({
          index,
          ok: true,
          id: data.id,
          slug: data.slug,
          display_name: data.display_name,
        });

        if (model.notes?.trim()) {
          await supabase.from("model_notes").insert({
            model_id: data.id,
            body: `IMPORTADO DE ARQUIVO — ${model.notes.trim()}`,
            priority: "normal",
            created_by_name: "Importador de PDF/imagem (assistente Claude)",
          });
        }
      } catch (rowError) {
        results.push({
          index,
          ok: false,
          display_name: displayName,
          error:
            rowError instanceof Error
              ? rowError.message
              : "Erro inesperado ao salvar.",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erro ao confirmar importação de modelos:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao salvar as modelos.",
      },
      { status: 500 },
    );
  }
}
