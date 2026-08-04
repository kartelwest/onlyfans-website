import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";
import { createApplicationNotes } from "@/lib/models/applicantIntake";
import { logAuditEntry } from "@/lib/audit/auditLogger";
import { getTranslations } from "next-intl/server";

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
  representativeId?: string;
  otherRepresentative?: string;
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
  const tRoute = await getTranslations("errors.applyApi");
  try {
    const body = (await request.json()) as ApplyBody;

    const nomeCompleto = body.nomeCompleto?.trim();
    const dataNascimento = body.dataNascimento?.trim();
    const cidade = body.cidade?.trim();
    const estado = body.estado?.trim();
    const pais = body.pais?.trim();
    const whatsapp = body.whatsapp?.trim();
    const email = body.email?.trim().toLowerCase();
    const representativeId = body.representativeId?.trim();
    const otherRepresentative = body.otherRepresentative?.trim();
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
      (!representativeId && !otherRepresentative) ||
      !possuiOnlyfans ||
      !bloquearBrasil ||
      !mostrarRosto ||
      !moedaPreferida ||
      !frequenciaConteudo ||
      !motivoCandidatura
    ) {
      return NextResponse.json(
        { error: tRoute("requiredFields") },
        { status: 400 },
      );
    }

    if (!body.confirmacaoIdade) {
      return NextResponse.json(
        {
          error:
            tRoute("ageConfirmationRequired"),
        },
        { status: 400 },
      );
    }

    if (!isAtLeast18(dataNascimento)) {
      return NextResponse.json(
        {
          error: tRoute("mustBeAdult"),
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

    const validRepresentativeId =
      representativeId && isValidUuid(representativeId)
        ? representativeId
        : null;

    let referralSource = otherRepresentative || null;

    if (validRepresentativeId) {
      const { data: repRow } = await adminSupabase
        .from("profiles")
        .select("full_name")
        .eq("id", validRepresentativeId)
        .maybeSingle();

      if (repRow?.full_name) {
        referralSource = repRow.full_name;
      }
    }

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
          representative_id: validRepresentativeId,
          referral_source: referralSource,
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
        { error: getApplicantInsertErrorMessage(createModelError, tRoute) },
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
        representanteIndicacao:
          referralSource ?? "Não informado",
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

    await logAuditEntry(adminSupabase, {
      modelId: createdModel.id,
      action: "model_applied",
      fieldName: null,
      previousValue: null,
      newValue: nomeCompleto,
      actor: {
        id: "00000000-0000-0000-0000-000000000000",
        fullName: NOTE_AUTHOR_NAME,
        role: "model",
      },
      source: "api:/api/aplicar",
      summary: `Nova candidatura recebida pelo site: "${nomeCompleto}"`,
    });

    return NextResponse.json(
      { success: true, modelId: createdModel.id, slug: createdModel.slug },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro inesperado ao processar candidatura:", error);

    return NextResponse.json(
      { error: tRoute("unexpected") },
      { status: 500 },
    );
  }
}

function getApplicantInsertErrorMessage(
  error: PostgrestError | null,
  t: (key: string) => string,
): string {
  switch (error?.code) {
    case "22P02":
      return t("insertUnknownStatus");
    case "23505":
      return t("insertDuplicate");
    case "23502":
      return t("insertMissingFields");
    default:
      return t("insertFailed");
  }
}

function isValidUuid(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isAtLeast18(dateOfBirth: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const today = new Date();

  let age = today.getFullYear() - year;

  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month &&
      today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= 18;
}
