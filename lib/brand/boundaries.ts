import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ClientBoundaries } from "@/types/brand";

export async function getClientBoundaries(
  talentId: string,
): Promise<ClientBoundaries | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("client_boundaries")
    .select("*")
    .eq("talent_id", talentId)
    .maybeSingle();

  if (!data) return null;

  return mapClientBoundaries(data);
}

export function evaluateContentAgainstBoundaries(
  content: string,
  boundaries: ClientBoundaries,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  const normalized = content.toLowerCase();

  for (const word of boundaries.prohibitedWords) {
    if (word && normalized.includes(word.toLowerCase())) {
      violations.push(`Palavra proibida detectada: ${word}`);
    }
  }

  for (const subject of boundaries.prohibitedSubjects) {
    if (subject && normalized.includes(subject.toLowerCase())) {
      violations.push(`Assunto proibido detectado: ${subject}`);
    }
  }

  for (const account of boundaries.accountsNotToMention) {
    if (account && normalized.includes(account.toLowerCase())) {
      violations.push(`Menção não autorizada: ${account}`);
    }
  }

  for (const detail of boundaries.privateDetailsNeverReveal) {
    if (detail && normalized.includes(detail.toLowerCase())) {
      violations.push(`Detalhe privado detectado: ${detail}`);
    }
  }

  if (boundaries.neverGenerateNudity) {
    violations.push(...detectNudityFlags(normalized));
  }

  return { safe: violations.length === 0, violations };
}

function detectNudityFlags(text: string): string[] {
  const flags: string[] = [];
  const nudityTerms = ["nude", "naked", "nua", "nu ", "sem roupa", "pelada", "pelado"];
  for (const term of nudityTerms) {
    if (text.includes(term)) {
      flags.push("Conteúdo com possível referência a nudez/sexualidade explícita detectada.");
      break;
    }
  }
  return flags;
}

function mapClientBoundaries(row: Record<string, unknown>): ClientBoundaries {
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    prohibitedSubjects: Array.isArray(row.prohibited_subjects)
      ? row.prohibited_subjects.map(String)
      : [],
    prohibitedWords: Array.isArray(row.prohibited_words)
      ? row.prohibited_words.map(String)
      : [],
    politicalBoundary: row.political_boundary ? String(row.political_boundary) : null,
    religiousBoundary: row.religious_boundary ? String(row.religious_boundary) : null,
    sexualBoundary: row.sexual_boundary ? String(row.sexual_boundary) : null,
    clothingBoundary: row.clothing_boundary ? String(row.clothing_boundary) : null,
    commentDmBoundary: row.comment_dm_boundary ? String(row.comment_dm_boundary) : null,
    accountsNotToMention: Array.isArray(row.accounts_not_to_mention)
      ? row.accounts_not_to_mention.map(String)
      : [],
    privateDetailsNeverReveal: Array.isArray(row.private_details_never_reveal)
      ? row.private_details_never_reveal.map(String)
      : [],
    crisisTopics: Array.isArray(row.crisis_topics) ? row.crisis_topics.map(String) : [],
    neverGenerateNudity: Boolean(row.never_generate_nudity),
    neverImpersonateReal: Boolean(row.never_impersonate_real),
    neverMisleadingClaims: Boolean(row.never_misleading_claims),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
