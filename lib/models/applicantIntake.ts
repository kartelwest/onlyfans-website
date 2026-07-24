import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatBrazilDateTime } from "@/lib/models/formatDateTime";

export const REFERRAL_TOKENS: Record<string, string[]> = {
  Kartel: ["Kartel"],
  Rayssa: ["Rayssa"],
  "Antonio (Tony)": ["Antonio", "Tony", "Antônio"],
};

export type ApplicationAnswers = {
  frequenciaConteudo?: string;
  motivoCandidatura?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  representanteIndicacao?: string;
  possuiOnlyfans?: string;
  entendeNovaConta?: boolean;
  administrarContaExistente?: string | null;
  bloquearBrasil?: string;
  mostrarRosto?: string;
  moedaPreferida?: string;
};

export async function findReferredRepresentativeId(
  supabase: SupabaseClient,
  referral: string,
): Promise<string | null> {
  const tokens = REFERRAL_TOKENS[referral];

  if (!tokens) {
    return null;
  }

  for (const token of tokens) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "representative")
      .eq("active", true)
      .ilike("full_name", `%${token}%`)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  return null;
}

export function hasAnyApplicationAnswer(answers: ApplicationAnswers): boolean {
  return Boolean(
    answers.frequenciaConteudo ||
      answers.motivoCandidatura ||
      answers.cidade ||
      answers.estado ||
      answers.pais ||
      answers.representanteIndicacao ||
      answers.possuiOnlyfans ||
      answers.bloquearBrasil ||
      answers.mostrarRosto ||
      answers.moedaPreferida,
  );
}

export function buildApplicationNote(
  timestamp: string,
  answers: ApplicationAnswers,
  header = "NOVO CANDIDATO",
): string {
  const lines = [`${header} — [${timestamp}]`];

  if (answers.frequenciaConteudo) {
    lines.push(
      `COM QUE FREQUÊNCIA PODE PRODUZIR CONTEÚDO? — ${answers.frequenciaConteudo}`,
    );
  }

  if (answers.motivoCandidatura) {
    lines.push(
      `Por que deseja entrar para nossa agência — ${answers.motivoCandidatura}`,
    );
  }

  const location = [answers.cidade, answers.estado, answers.pais]
    .filter(Boolean)
    .join(", ");

  if (location) {
    lines.push(`Localização — ${location}`);
  }

  if (answers.representanteIndicacao) {
    lines.push(`Indicação — ${answers.representanteIndicacao}`);
  }

  if (answers.possuiOnlyfans) {
    lines.push(
      `Já possui OnlyFans — ${answers.possuiOnlyfans === "sim" ? "Sim" : "Não"}`,
    );

    if (
      answers.possuiOnlyfans === "sim" &&
      answers.entendeNovaConta !== undefined
    ) {
      lines.push(
        `Entende que a agência criará nova conta principal — ${
          answers.entendeNovaConta ? "Sim" : "Não"
        }`,
      );

      if (answers.administrarContaExistente) {
        lines.push(
          `Deseja administração da conta existente — ${answers.administrarContaExistente}`,
        );
      }
    }
  }

  if (answers.bloquearBrasil) {
    lines.push(`Deseja bloquear o Brasil — ${answers.bloquearBrasil}`);
  }

  if (answers.mostrarRosto) {
    lines.push(`Confortável em mostrar o rosto — ${answers.mostrarRosto}`);
  }

  if (answers.moedaPreferida) {
    lines.push(`Moeda preferida — ${answers.moedaPreferida}`);
  }

  return lines.join("\n");
}

export async function createApplicationNotes(
  supabase: SupabaseClient,
  modelId: string,
  answers: ApplicationAnswers,
  authorName: string,
  header = "NOVO CANDIDATO",
) {
  const timestamp = formatBrazilDateTime(new Date());

  const body = buildApplicationNote(timestamp, answers, header);

  const { data: createdNote, error: createNoteError } = await supabase
    .from("model_notes")
    .insert({
      model_id: modelId,
      body,
      priority: "normal",
      created_by_name: authorName,
    })
    .select("id")
    .single();

  if (createNoteError || !createdNote) {
    console.error("Erro ao registrar nota da candidatura:", createNoteError);

    return;
  }

  const { error: historyError } = await supabase
    .from("model_note_history")
    .insert({
      note_id: createdNote.id,
      model_id: modelId,
      action: "created",
      original_body: null,
      updated_body: body,
      editor_name: authorName,
    });

  if (historyError) {
    console.error("Erro ao registrar histórico da nota da candidatura:", historyError);
  }
}
