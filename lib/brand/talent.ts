import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationMode, BrandProfile, ServiceEnrollment, Talent } from "@/types/brand";

export interface CreateTalentInput {
  legalName?: string | null;
  stageName: string;
  displayName: string;
  preferredUsername?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  birthday?: string | null;
  age?: number | null;
  location?: string | null;
  nationality?: string | null;
  languages?: string[] | null;
  occupation?: string | null;
  brandCategory?: string | null;
  profileId?: string | null;
  modelId?: string | null;
}

export interface CreateBrandOnlyClientInput extends CreateTalentInput {
  niche1: string;
  niche2?: string | null;
  niche3?: string | null;
  primaryPositioning?: string | null;
  secondaryPositioning?: string | null;
  targetCountries?: string[] | null;
  targetCities?: string[] | null;
  targetLanguages?: string[] | null;
  targetGender?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  targetInterests?: string[] | null;
  objectives?: Record<string, unknown>[];
  instagramAutomationMode?: "manual" | "approval_based" | "controlled_autopilot";
  xAutomationMode?: "manual" | "approval_based" | "controlled_autopilot";
  aiGuidance?: string | null;
  defaultLanguages?: string[];
}

export async function createBrandOnlyClient(
  input: CreateBrandOnlyClientInput,
): Promise<{ talent?: Talent; brandProfile?: BrandProfile; error?: string }> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Não autenticado." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !profile.active || !["owner", "administrator"].includes(profile.role)) {
    return { error: "Permissão negada." };
  }

  const serviceTypeRes = await supabase
    .from("service_types")
    .select("id")
    .eq("code", "brand_growth")
    .single();

  if (!serviceTypeRes.data) {
    return { error: "Tipo de serviço Brand Growth não encontrado." };
  }

  // Insert talent using admin client so we can override RLS during creation.
  const admin = createAdminClient();

  const { data: talent, error: talentError } = await admin
    .from("talents")
    .insert({
      profile_id: input.profileId ?? null,
      model_id: input.modelId ?? null,
      legal_name: input.legalName ?? null,
      stage_name: input.stageName,
      display_name: input.displayName,
      preferred_username: input.preferredUsername ?? null,
      email: input.email ?? null,
      whatsapp: input.whatsapp ?? null,
      birthday: input.birthday ?? null,
      age: input.age ?? null,
      location: input.location ?? null,
      nationality: input.nationality ?? null,
      languages: input.languages ?? null,
      occupation: input.occupation ?? null,
      brand_category: input.brandCategory ?? null,
      active: true,
    })
    .select()
    .single();

  if (talentError || !talent) {
    return { error: talentError?.message ?? "Erro ao criar talento." };
  }

  const { data: brandProfile, error: profileError } = await admin
    .from("brand_profiles")
    .insert({
      talent_id: talent.id,
      display_name: input.displayName,
      preferred_username: input.preferredUsername ?? null,
      niche_1: input.niche1,
      niche_2: input.niche2 ?? null,
      niche_3: input.niche3 ?? null,
      primary_positioning: input.primaryPositioning ?? null,
      secondary_positioning: input.secondaryPositioning ?? null,
      target_countries: input.targetCountries ?? null,
      target_cities: input.targetCities ?? null,
      target_languages: input.targetLanguages ?? null,
      target_gender: input.targetGender ?? null,
      target_age_min: input.targetAgeMin ?? null,
      target_age_max: input.targetAgeMax ?? null,
      target_interests: input.targetInterests ?? null,
      objectives: input.objectives ?? [],
      instagram_automation_mode: input.instagramAutomationMode ?? "manual",
      x_automation_mode: input.xAutomationMode ?? "manual",
      ai_guidance: input.aiGuidance ?? null,
      default_languages: input.defaultLanguages ?? ["pt-BR"],
    })
    .select()
    .single();

  if (profileError) {
    return { error: profileError.message };
  }

  await admin.from("service_enrollments").insert({
    talent_id: talent.id,
    service_type_id: serviceTypeRes.data.id,
    status: "active",
    started_at: new Date().toISOString(),
  });

  return {
    talent: mapTalent(talent),
    brandProfile: mapBrandProfile(brandProfile),
  };
}

export async function getTalentWithBrandProfile(talentId: string): Promise<{
  talent?: Talent;
  brandProfile?: BrandProfile;
  enrollments?: ServiceEnrollment[];
  error?: string;
}> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Não autenticado." };
  }

  const { data: talent, error: talentError } = await supabase
    .from("talents")
    .select("*")
    .eq("id", talentId)
    .single();

  if (talentError || !talent) {
    return { error: talentError?.message ?? "Talento não encontrado." };
  }

  const { data: brandProfile, error: profileError } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("talent_id", talentId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  const { data: enrollments } = await supabase
    .from("service_enrollments")
    .select("*, service_types(code)")
    .eq("talent_id", talentId);

  return {
    talent: mapTalent(talent),
    brandProfile: brandProfile ? mapBrandProfile(brandProfile) : undefined,
    enrollments: (enrollments ?? []).map(mapEnrollment),
  };
}

export async function enrollModelInBrandGrowth(modelId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "administrator"].includes(profile.role)) {
    return { error: "Permissão negada." };
  }

  const admin = createAdminClient();

  const talentResult = await getOrCreateTalentForModel(modelId, admin);
  if ("error" in talentResult) {
    return { error: talentResult.error };
  }
  const talentId = talentResult.id;

  // Make sure a brand profile exists before enrolling in Brand Growth.
  const { data: existingBrandProfile } = await admin
    .from("brand_profiles")
    .select("id")
    .eq("talent_id", talentId)
    .maybeSingle();

  if (!existingBrandProfile) {
    const { data: model } = await admin
      .from("models")
      .select("display_name")
      .eq("id", modelId)
      .maybeSingle();

    const { error: brandProfileError } = await admin
      .from("brand_profiles")
      .insert({
        talent_id: talentId,
        display_name: String(model?.display_name ?? ""),
        niche_1: "lifestyle",
        default_languages: ["pt-BR"],
      });

    if (brandProfileError) {
      return { error: brandProfileError.message };
    }
  }

  const { data: serviceType } = await admin
    .from("service_types")
    .select("id")
    .eq("code", "brand_growth")
    .single();

  if (!serviceType) {
    return { error: "Tipo de serviço Brand Growth não encontrado." };
  }

  const { error } = await admin.from("service_enrollments").upsert(
    {
      talent_id: talentId,
      service_type_id: serviceType.id,
      status: "active",
      started_at: new Date().toISOString(),
    },
    { onConflict: "talent_id, service_type_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return {};
}

/**
 * Ensures that a `models` row has a canonical `talents` identity and an
 * `onlyfans` service enrollment whose status mirrors `models.active`.
 * Also creates a minimal `brand_profiles` row so the Amplia detail view can
 * render a brand status even for models that have not yet gone through a
 * full brand-growth onboarding.
 */
export async function ensureOnlyFansEnrollmentForModel(
  modelId: string,
): Promise<{ talentId?: string; error?: string }> {
  const admin = createAdminClient();

  const { data: model, error: modelError } = await admin
    .from("models")
    .select("id, display_name, active")
    .eq("id", modelId)
    .maybeSingle();

  if (modelError || !model) {
    return { error: modelError?.message ?? "Modelo não encontrado." };
  }

  const talentResult = await getOrCreateTalentForModel(modelId, admin);
  if ("error" in talentResult) {
    return { error: talentResult.error };
  }
  const talentId = talentResult.id;

  const { data: serviceType } = await admin
    .from("service_types")
    .select("id")
    .eq("code", "onlyfans")
    .single();

  if (!serviceType) {
    return { error: "Tipo de serviço OnlyFans não encontrado." };
  }

  const status = model.active ? "active" : "inactive";
  const { error: enrollmentError } = await admin
    .from("service_enrollments")
    .upsert(
      {
        talent_id: talentId,
        service_type_id: serviceType.id,
        status,
        started_at: model.active ? new Date().toISOString() : null,
      },
      { onConflict: "talent_id, service_type_id" },
    );

  if (enrollmentError) {
    return { error: enrollmentError.message };
  }

  // Best-effort: keep the legacy models.talent_id FK in sync. New code does
  // not rely on this column, but existing migrations created it.
  try {
    await admin.from("models").update({ talent_id: talentId }).eq("id", modelId);
  } catch {
    // ignored
  }

  return { talentId };
}

async function getOrCreateTalentForModel(
  modelId: string,
  adminClient?: SupabaseClient,
): Promise<{ id: string } | { error: string }> {
  const admin = adminClient ?? createAdminClient();

  const { data: model, error: modelError } = await admin
    .from("models")
    .select(
      "id, profile_id, display_name, stage_name, email, whatsapp, birthday, nationality, city, language, active",
    )
    .eq("id", modelId)
    .maybeSingle();

  if (modelError || !model) {
    return { error: modelError?.message ?? "Modelo não encontrado." };
  }

  const { data: existingByModel } = await admin
    .from("talents")
    .select("id")
    .eq("model_id", modelId)
    .maybeSingle();

  if (existingByModel) {
    return { id: existingByModel.id };
  }

  if (model.profile_id) {
    const { data: existingByProfile } = await admin
      .from("talents")
      .select("id, model_id")
      .eq("profile_id", model.profile_id)
      .maybeSingle();

    if (existingByProfile) {
      const { error: updateError } = await admin
        .from("talents")
        .update({
          model_id: modelId,
          display_name: String(model.display_name ?? ""),
          stage_name: model.stage_name ? String(model.stage_name) : null,
          email: model.email ? String(model.email) : null,
          whatsapp: model.whatsapp ? String(model.whatsapp) : null,
          birthday: model.birthday ? String(model.birthday) : null,
          nationality: model.nationality ? String(model.nationality) : null,
          location: model.city ? String(model.city) : null,
          languages: model.language ? [String(model.language)] : null,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingByProfile.id);

      if (updateError) {
        return { error: updateError.message };
      }

      return { id: existingByProfile.id };
    }
  }

  const { data: profile } = model.profile_id
    ? await admin
        .from("profiles")
        .select("full_name")
        .eq("id", model.profile_id)
        .maybeSingle()
    : { data: null };

  const legalName = profile?.full_name ?? String(model.display_name ?? "");

  const { data: talent, error: talentError } = await admin
    .from("talents")
    .insert({
      profile_id: model.profile_id ? String(model.profile_id) : null,
      model_id: modelId,
      legal_name: legalName,
      stage_name: model.stage_name ? String(model.stage_name) : null,
      display_name: String(model.display_name ?? ""),
      email: model.email ? String(model.email) : null,
      whatsapp: model.whatsapp ? String(model.whatsapp) : null,
      birthday: model.birthday ? String(model.birthday) : null,
      nationality: model.nationality ? String(model.nationality) : null,
      location: model.city ? String(model.city) : null,
      languages: model.language ? [String(model.language)] : null,
      active: true,
    })
    .select("id")
    .single();

  if (talentError || !talent) {
    return { error: talentError?.message ?? "Erro ao criar talento para a modelo." };
  }

  return { id: talent.id };
}

function mapTalent(row: Record<string, unknown>): Talent {
  return {
    id: String(row.id),
    profileId: row.profile_id ? String(row.profile_id) : null,
    modelId: row.model_id ? String(row.model_id) : null,
    legalName: row.legal_name ? String(row.legal_name) : null,
    stageName: row.stage_name ? String(row.stage_name) : null,
    displayName: String(row.display_name ?? ""),
    preferredUsername: row.preferred_username ? String(row.preferred_username) : null,
    pronunciation: row.pronunciation ? String(row.pronunciation) : null,
    email: row.email ? String(row.email) : null,
    whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    birthday: row.birthday ? String(row.birthday) : null,
    age: typeof row.age === "number" ? row.age : null,
    location: row.location ? String(row.location) : null,
    nationality: row.nationality ? String(row.nationality) : null,
    languages: Array.isArray(row.languages) ? row.languages.map(String) : null,
    occupation: row.occupation ? String(row.occupation) : null,
    brandCategory: row.brand_category ? String(row.brand_category) : null,
    active: Boolean(row.active),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapBrandProfile(row: Record<string, unknown>): BrandProfile {
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    displayName: row.display_name ? String(row.display_name) : null,
    pronunciation: row.pronunciation ? String(row.pronunciation) : null,
    preferredUsername: row.preferred_username ? String(row.preferred_username) : null,
    alternateUsernames: Array.isArray(row.alternate_usernames)
      ? row.alternate_usernames.map(String)
      : null,
    age: typeof row.age === "number" ? row.age : null,
    location: row.location ? String(row.location) : null,
    nationality: row.nationality ? String(row.nationality) : null,
    languages: Array.isArray(row.languages) ? row.languages.map(String) : null,
    occupation: row.occupation ? String(row.occupation) : null,
    brandCategory: row.brand_category ? String(row.brand_category) : null,
    niche1: String(row.niche_1 ?? ""),
    niche2: row.niche_2 ? String(row.niche_2) : null,
    niche3: row.niche_3 ? String(row.niche_3) : null,
    primaryPositioning: row.primary_positioning ? String(row.primary_positioning) : null,
    secondaryPositioning: row.secondary_positioning ? String(row.secondary_positioning) : null,
    customPositioning: row.custom_positioning ? String(row.custom_positioning) : null,
    targetCountries: Array.isArray(row.target_countries) ? row.target_countries.map(String) : null,
    targetCities: Array.isArray(row.target_cities) ? row.target_cities.map(String) : null,
    targetLanguages: Array.isArray(row.target_languages) ? row.target_languages.map(String) : null,
    targetGender: row.target_gender ? String(row.target_gender) : null,
    targetAgeMin: typeof row.target_age_min === "number" ? row.target_age_min : null,
    targetAgeMax: typeof row.target_age_max === "number" ? row.target_age_max : null,
    targetInterests: Array.isArray(row.target_interests) ? row.target_interests.map(String) : null,
    desiredPartnerships: row.desired_partnerships ? String(row.desired_partnerships) : null,
    desiredFollowerProfile: row.desired_follower_profile ? String(row.desired_follower_profile) : null,
    marketsToAvoid: Array.isArray(row.markets_to_avoid) ? row.markets_to_avoid.map(String) : null,
    objectives: Array.isArray(row.objectives) ? (row.objectives as Record<string, unknown>[]) : [],
    instagramAutomationMode: (row.instagram_automation_mode as AutomationMode) ?? "manual",
    xAutomationMode: (row.x_automation_mode as AutomationMode) ?? "manual",
    brandStatus: String(row.brand_status ?? "planning"),
    aiGuidance: row.ai_guidance ? String(row.ai_guidance) : null,
    dailyDirective: row.daily_directive ? String(row.daily_directive) : null,
    defaultLanguages: Array.isArray(row.default_languages) ? row.default_languages.map(String) : ["pt-BR"],
    allowAdultPlatformLinks: Boolean(row.allow_adult_platform_links),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapEnrollment(row: Record<string, unknown>): ServiceEnrollment {
  const serviceType = row.service_types as { code?: string } | null;
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    serviceTypeId: String(row.service_type_id),
    serviceTypeCode: serviceType?.code,
    status: String(row.status ?? "not_started"),
    startedAt: row.started_at ? String(row.started_at) : null,
    pausedAt: row.paused_at ? String(row.paused_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
