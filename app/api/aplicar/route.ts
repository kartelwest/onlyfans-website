import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";
import {
  createApplicationNotes,
  findReferredRepresentativeId,
} from "@/lib/models/applicantIntake";

export const dynamic = "force-dynamic";

type ApplyBody = {
  nomeCompleto?: string;
  nomeArtisticoDesejado?: string;
  dataNascimento?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  twitter?: string;
  representanteIndicacao?: string;
  possuiOnlyfans?: string;
  entendeNovaConta?: boolean;
  administrarContaExistente?: string;
  bloquearBrasil?: string;
  mostrarRosto?: string;
  moedaPreferida?: string;
  frequenciaConteudo?: string;
  motivoCandidatura?: string;
  confirmacaoIdade?: boolean;
};

const NOTE_AUTHOR_NAME = "Formulário de candidatura (site)";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApplyBody;

    const nomeCompleto = body.nomeCompleto?.trim();
    const dataNascimento = body.dataNascimento?.trim();
    const cidade = body.cidade?.trim();
    const estado = body.estado?.trim();
    const pais = body.pais?.trim();
    const whatsapp = body.whatsapp?.trim();
    const email = body.email?.trim().toLowerCase();
    const representanteIndicacao = body.representanteIndicacao?.trim();
    const possuiOnlyfans = body.possuiOnlyfans?.trim();
    const bloquearBrasil = body.bloquearBrasil?.trim();
    const mostrarRosto = body.mostrarRosto?.trim();
    const moedaPreferida = body.moedaPreferida?.trim();
    const frequenciaConteudo = body.frequenciaConteudo?.trim();
    const motivoCandidatura = body.motivoCandidatura?.trim();

    if (
      !nomeCompleto ||
      !dataNascimento ||
      !cidade ||
      !estado ||
      !pais ||
      !whatsapp ||
      !email ||
      !representanteIndicacao ||
      !possuiOnlyfans ||
      !bloquearBrasil ||
      !mostrarRosto ||
      !moedaPreferida ||
      !frequenciaConteudo ||
      !motivoCandidatura
    ) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios." },
        { status: 400 },
      );
    }

    if (!body.confirmacaoIdade) {
      return NextResponse.json(
        {
          error:
            "É necessário confirmar que você tem pelo menos 18 anos.",
        },
        { status: 400 },
      );
    }

    if (!isAtLeast18(dataNascimento)) {
      return NextResponse.json(
        {
          error: "É necessário ter pelo menos 18 anos para se candidatar.",
        },
        { status: 400 },
      );
    }

    const adminSupabase = createAdminClient();

    const stageName = body.nomeArtisticoDesejado?.trim() || null;

    const slug = await createUniqueModelSlug(
      adminSupabase,
      stageName || nomeCompleto,
    );

    const modelNumber = await getNextModelNumber(adminSupabase);

    const representativeId = await findReferredRepresentativeId(
      adminSupabase,
      representanteIndicacao,
    );

    const { data: createdModel, error: createModelError } =
      await adminSupabase
        .from("models")
        .insert({
          model_number: modelNumber,
          slug,
          display_name: nomeCompleto,
          stage_name: stageName,
          birthday: dataNascimento,
          nationality: pais,
          city: `${cidade}, ${estado}`,
          email,
          whatsapp,
          instagram: body.instagram?.trim() || null,
          twitter: body.twitter?.trim() || null,
          representative_id: representativeId,
          status: "candidate",
          active: false,
          onboarding_percentage: 0,
          latest_note_summary: "Nova candidatura recebida pelo site.",
        })
        .select("id, slug")
        .single();

    if (createModelError || !createdModel) {
      console.error(
        "Erro ao criar candidata a partir do formulário:",
        createModelError,
      );

      return NextResponse.json(
        { error: getApplicantInsertErrorMessage(createModelError) },
        { status: 500 },
      );
    }

    await createApplicationNotes(
      adminSupabase,
      createdModel.id,
      {
        frequenciaConteudo,
        motivoCandidatura,
        cidade,
        estado,
        pais,
        representanteIndicacao,
        possuiOnlyfans,
        entendeNovaConta: body.entendeNovaConta ?? false,
        administrarContaExistente:
          body.administrarContaExistente?.trim() || null,
        bloquearBrasil,
        mostrarRosto,
        moedaPreferida,
      },
      NOTE_AUTHOR_NAME,
    );

    return NextResponse.json(
      { success: true, modelId: createdModel.id, slug: createdModel.slug },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro inesperado ao processar candidatura:", error);

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado ao enviar a candidatura." },
      { status: 500 },
    );
  }
}

function getApplicantInsertErrorMessage(
  error: PostgrestError | null,
): string {
  switch (error?.code) {
    case "22P02":
      return "Não foi possível registrar a candidatura: o status inicial da candidata não é reconhecido pelo banco de dados. Contate o suporte.";
    case "23505":
      return "Já existe uma candidatura registrada com esse identificador. Entre em contato com o suporte.";
    case "23502":
      return "Não foi possível registrar a candidatura: faltam informações obrigatórias.";
    default:
      return "Não foi possível registrar a candidatura. Tente novamente em instantes ou entre em contato com o suporte.";
  }
}

function isAtLeast18(dateOfBirth: string): boolean {
  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return false;
  }

  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= 18;
}
