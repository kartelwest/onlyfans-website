"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ConsentType } from "@/types/amplia";

export type DetailActionState = {
  success: boolean;
  message: string;
};

const fail = (message: string): DetailActionState => ({
  success: false,
  message,
});

async function requireManagementUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "Sua sessão expirou. Entre novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !profile.active ||
    (profile.role !== "owner" && profile.role !== "administrator")
  ) {
    return {
      supabase,
      user: null,
      error: "Você não tem permissão para editar clientes do Amplia.",
    };
  }

  return { supabase, user, error: null };
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateBrandProfileAction(
  _previousState: DetailActionState,
  formData: FormData,
): Promise<DetailActionState> {
  const talentId = String(formData.get("talentId") ?? "");
  const niche1 = String(formData.get("niche1") ?? "").trim();

  if (!talentId) return fail("Cliente inválida.");
  if (!niche1) return fail("O nicho principal é obrigatório.");

  const { supabase, user, error } = await requireManagementUser();
  if (error || !user) return fail(error ?? "Não autorizado.");

  const { error: updateError } = await supabase
    .from("brand_profiles")
    .update({
      niche_1: niche1,
      niche_2: String(formData.get("niche2") ?? "").trim() || null,
      niche_3: String(formData.get("niche3") ?? "").trim() || null,
      ai_guidance: String(formData.get("aiGuidance") ?? "").trim() || null,
      primary_positioning:
        String(formData.get("primaryPositioning") ?? "").trim() || null,
      brand_voice: String(formData.get("brandVoice") ?? "").trim() || null,
      target_countries: splitList(formData.get("targetCountries")),
      target_languages: splitList(formData.get("targetLanguages")),
      topics_to_avoid: splitList(formData.get("topicsToAvoid")),
      status: String(formData.get("status") ?? "draft"),
      updated_by: user.id,
    })
    .eq("talent_id", talentId);

  if (updateError) {
    return fail(`Não foi possível salvar o perfil de marca: ${updateError.message}`);
  }

  revalidatePath(`/amplia/clientes/${talentId}`);
  return { success: true, message: "Perfil de marca atualizado." };
}

export async function recordConsentAction(
  _previousState: DetailActionState,
  formData: FormData,
): Promise<DetailActionState> {
  const talentId = String(formData.get("talentId") ?? "");
  const consentType = String(formData.get("consentType") ?? "") as ConsentType;
  const granted = formData.get("granted") === "granted";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!talentId || !consentType) return fail("Dados de consentimento inválidos.");

  const { supabase, user, error } = await requireManagementUser();
  if (error || !user) return fail(error ?? "Não autorizado.");

  const { error: insertError } = await supabase.from("client_consents").insert({
    talent_id: talentId,
    consent_type: consentType,
    granted,
    recorded_by: user.id,
    notes: notes || null,
  });

  if (insertError) {
    return fail(`Não foi possível registrar o consentimento: ${insertError.message}`);
  }

  revalidatePath(`/amplia/clientes/${talentId}`);
  return {
    success: true,
    message: granted ? "Consentimento concedido registrado." : "Revogação registrada.",
  };
}

export async function upsertBoundariesAction(
  _previousState: DetailActionState,
  formData: FormData,
): Promise<DetailActionState> {
  const talentId = String(formData.get("talentId") ?? "");
  if (!talentId) return fail("Cliente inválida.");

  const { supabase, user, error } = await requireManagementUser();
  if (error || !user) return fail(error ?? "Não autorizado.");

  const { error: upsertError } = await supabase.from("client_boundaries").upsert(
    {
      talent_id: talentId,
      prohibited_subjects: splitList(formData.get("prohibitedSubjects")),
      prohibited_words: splitList(formData.get("prohibitedWords")),
      political_boundary:
        String(formData.get("politicalBoundary") ?? "").trim() || null,
      sexual_boundary:
        String(formData.get("sexualBoundary") ?? "").trim() || null,
      comment_boundary:
        String(formData.get("commentBoundary") ?? "").trim() || null,
      dm_boundary: String(formData.get("dmBoundary") ?? "").trim() || null,
      accounts_not_to_mention: splitList(formData.get("accountsNotToMention")),
      private_details_never_reveal: splitList(
        formData.get("privateDetailsNeverReveal"),
      ),
      crisis_topics: splitList(formData.get("crisisTopics")),
      updated_by: user.id,
    },
    { onConflict: "talent_id" },
  );

  if (upsertError) {
    return fail(`Não foi possível salvar os limites: ${upsertError.message}`);
  }

  revalidatePath(`/amplia/clientes/${talentId}`);
  return { success: true, message: "Limites da cliente salvos." };
}

export async function createGrowthGoalAction(
  _previousState: DetailActionState,
  formData: FormData,
): Promise<DetailActionState> {
  const talentId = String(formData.get("talentId") ?? "");
  const objective = String(formData.get("objective") ?? "").trim();

  if (!talentId) return fail("Cliente inválida.");
  if (!objective) return fail("Descreva o objetivo.");

  const { supabase, user, error } = await requireManagementUser();
  if (error || !user) return fail(error ?? "Não autorizado.");

  const platform = String(formData.get("platform") ?? "");

  const { error: insertError } = await supabase.from("growth_goals").insert({
    talent_id: talentId,
    platform: platform === "instagram" || platform === "x" ? platform : null,
    objective,
    priority: String(formData.get("priority") ?? "medium"),
    start_value: formData.get("startValue")
      ? Number(formData.get("startValue"))
      : null,
    target_value: formData.get("targetValue")
      ? Number(formData.get("targetValue"))
      : null,
    target_date: String(formData.get("targetDate") ?? "") || null,
    measurement_method:
      String(formData.get("measurementMethod") ?? "").trim() || null,
    created_by: user.id,
  });

  if (insertError) {
    return fail(`Não foi possível criar o objetivo: ${insertError.message}`);
  }

  revalidatePath(`/amplia/clientes/${talentId}`);
  return { success: true, message: "Objetivo criado." };
}
