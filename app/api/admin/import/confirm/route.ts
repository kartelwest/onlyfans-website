import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";
import {
  createApplicationNotes,
  findReferredRepresentativeId,
  hasAnyApplicationAnswer,
} from "@/lib/models/applicantIntake";
import type { ExtractedApplicant } from "@/lib/anthropic/importTool";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const NOTE_AUTHOR_NAME = "Importador de PDF/imagem (assistente Claude)";
const NOTE_HEADER = "CANDIDATA IMPORTADA (PDF/imagem)";

type ConfirmBody = {
  applicants?: ExtractedApplicant[];
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

    if (!Array.isArray(body.applicants) || body.applicants.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma candidata para salvar." },
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

    for (let index = 0; index < body.applicants.length; index++) {
      const applicant = body.applicants[index];
      const nomeCompleto = applicant.nomeCompleto?.trim();

      if (!nomeCompleto) {
        results.push({
          index,
          ok: false,
          display_name: "(sem nome)",
          error: "Nome completo é obrigatório.",
        });
        continue;
      }

      try {
        const stageName = applicant.nomeArtisticoDesejado?.trim() || null;
        const cidade = applicant.cidade?.trim() || "";
        const estado = applicant.estado?.trim() || "";
        const pais = applicant.pais?.trim() || "";
        const representanteIndicacao =
          applicant.representanteIndicacao?.trim() || "";

        const slug = await createUniqueModelSlug(
          supabase,
          stageName || nomeCompleto,
        );

        const modelNumber = await getNextModelNumber(supabase);

        const representativeId = representanteIndicacao
          ? await findReferredRepresentativeId(supabase, representanteIndicacao)
          : null;

        const cityParts = [cidade, estado].filter(Boolean);

        const insertPayload: Record<string, unknown> = {
          model_number: modelNumber,
          slug,
          display_name: nomeCompleto,
          stage_name: stageName,
          representative_id: representativeId,
          status: "candidate",
          active: false,
          onboarding_percentage: 0,
          latest_note_summary:
            "Candidata importada de PDF/imagem (assistente Claude).",
        };

        if (applicant.dataNascimento?.trim()) {
          insertPayload.birthday = applicant.dataNascimento.trim();
        }

        if (cityParts.length > 0) {
          insertPayload.city = cityParts.join(", ");
        }

        if (pais) {
          insertPayload.nationality = pais;
        }

        if (applicant.email?.trim()) {
          insertPayload.email = applicant.email.trim().toLowerCase();
        }

        if (applicant.whatsapp?.trim()) {
          insertPayload.whatsapp = applicant.whatsapp.trim();
        }

        if (applicant.instagram?.trim()) {
          insertPayload.instagram = applicant.instagram.trim();
        }

        if (applicant.twitter?.trim()) {
          insertPayload.twitter = applicant.twitter.trim();
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
            display_name: nomeCompleto,
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

        const answers = {
          frequenciaConteudo: applicant.frequenciaConteudo?.trim() || undefined,
          motivoCandidatura: applicant.motivoCandidatura?.trim() || undefined,
          cidade: cidade || undefined,
          estado: estado || undefined,
          pais: pais || undefined,
          representanteIndicacao: representanteIndicacao || undefined,
          possuiOnlyfans: applicant.possuiOnlyfans?.trim() || undefined,
          bloquearBrasil: applicant.bloquearBrasil?.trim() || undefined,
          mostrarRosto: applicant.mostrarRosto?.trim() || undefined,
          moedaPreferida: applicant.moedaPreferida?.trim() || undefined,
        };

        if (hasAnyApplicationAnswer(answers)) {
          await createApplicationNotes(
            supabase,
            data.id,
            answers,
            NOTE_AUTHOR_NAME,
            NOTE_HEADER,
          );
        }
      } catch (rowError) {
        results.push({
          index,
          ok: false,
          display_name: nomeCompleto,
          error:
            rowError instanceof Error
              ? rowError.message
              : "Erro inesperado ao salvar.",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erro ao confirmar importação de candidatas:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao salvar as candidatas.",
      },
      { status: 500 },
    );
  }
}
