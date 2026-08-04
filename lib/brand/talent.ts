import { getTranslations } from "next-intl/server";
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
  age?: number | null;
  location?: string | null;
  nationality?: string | null;
  languages?: string[] | null;
  occupation?: string | null;
  brandCategory?: string | null;
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
  aiGuidance?: string | null;
  defaultLanguages?: string[];
}

const BRAND_GROWTH_SERVICE_KEYS = ["brand_growth_instagram", "brand_growth_x"];

export async function createBrandOnlyClient(
  input: CreateBrandOnlyClientInput,
): Promise<{ talent?: Talent; brandProfile?: BrandProfile; error?: string }> {
  const t = await getTranslations("errors.brand");
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: t("notAuthenticated") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !profile.active || !["owner", "administrator"].includes(profile.role)) {
    return { error: t("permissionDenied") };
  }

  const admin = createAdminClient();

  const { data: serviceTypes } = await admin
    .from("service_types")
    .select("id, key")
    .in("key", [...BRAND_GROWTH_SERVICE_KEYS]);

  if (!serviceTypes || serviceTypes.length === 0) {
    return { error: t("serviceTypesMissing") };
  }

  const { data: talent, error: talentError } = await admin
    .from("talents")
    .insert({
      linked_model_id: input.modelId ?? null,
      legal_name: input.legalName ?? null,
      stage_name: input.stageName,
      display_name: input.displayName,
      preferred_username: input.preferredUsername ?? null,
      location: input.location ?? null,
      nationality: input.nationality ?? null,
      languages: input.languages ?? [],
      occupation: input.occupation ?? null,
      brand_category: input.brandCategory ?? null,
      active: true,
    })
    .select()
    .single();

  if (talentError || !talent) {
    return { error: talentError?.message ?? t("talentCreateFailed") };
  }

  const { data: brandProfile, error: profileError } = await admin
    .from("brand_profiles")
    .insert({
      talent_id: talent.id,
      niche_1: input.niche1,
      niche_2: input.niche2 ?? null,
      niche_3: input.niche3 ?? null,
      primary_positioning: input.primaryPositioning ?? null,
      secondary_positioning: input.secondaryPositioning ? [input.secondaryPositioning] : [],
      ai_guidance: input.aiGuidance ?? null,
      target_countries: input.targetCountries ?? [],
      target_cities: input.targetCities ?? [],
      target_languages: input.targetLanguages ?? [],
      target_gender: input.targetGender ?? null,
      target_age_min: input.targetAgeMin ?? null,
      target_age_max: input.targetAgeMax ?? null,
      target_interests: input.targetInterests ?? [],
      status: "planning",
    })
    .select()
    .single();

  if (profileError) {
    return { error: profileError.message };
  }

  const now = new Date().toISOString();
  for (const st of serviceTypes) {
    await admin.from("service_enrollments").upsert(
      {
        talent_id: talent.id,
        service_type_id: st.id,
        status: "active",
        enrolled_at: now,
      },
      { onConflict: "talent_id, service_type_id" },
    );
  }

  return {
    talent: mapTalent(talent),
    brandProfile: mapBrandProfile(brandProfile, input.displayName),
  };
}

export async function getTalentWithBrandProfile(talentId: string): Promise<{
  talent?: Talent;
  brandProfile?: BrandProfile;
  enrollments?: ServiceEnrollment[];
  error?: string;
}> {
  const t = await getTranslations("errors.brand");
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: t("notAuthenticated") };
  }

  const { data: talent, error: talentError } = await supabase
    .from("talents")
    .select("*")
    .eq("id", talentId)
    .single();

  if (talentError || !talent) {
    return { error: talentError?.message ?? t("talentNotFound") };
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
    .select("*, service_types(key)")
    .eq("talent_id", talentId);

  return {
    talent: mapTalent(talent),
    brandProfile: brandProfile ? mapBrandProfile(brandProfile, talent.display_name as string) : undefined,
    enrollments: (enrollments ?? []).map(mapEnrollment),
  };
}

export async function enrollModelInBrandGrowth(modelId: string): Promise<{ error?: string }> {
  const t = await getTranslations("errors.brand");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: t("notAuthenticated") };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "administrator"].includes(profile.role)) {
    return { error: t("permissionDenied") };
  }

  const admin = createAdminClient();

  const talentResult = await getOrCreateTalentForModel(modelId, admin);
  if ("error" in talentResult) {
    return { error: talentResult.error };
  }
  const talentId = talentResult.id;

  const { data: existingBrandProfile } = await admin
    .from("brand_profiles")
    .select("id")
    .eq("talent_id", talentId)
    .maybeSingle();

  if (!existingBrandProfile) {
    const { error: brandProfileError } = await admin.from("brand_profiles").insert({
      talent_id: talentId,
      niche_1: "lifestyle",
      status: "planning",
    });

    if (brandProfileError) {
      return { error: brandProfileError.message };
    }
  }

  const { data: serviceTypes } = await admin
    .from("service_types")
    .select("id, key")
    .in("key", BRAND_GROWTH_SERVICE_KEYS);

  if (!serviceTypes || serviceTypes.length === 0) {
    return { error: t("serviceTypesMissing") };
  }

  const now = new Date().toISOString();
  for (const st of serviceTypes) {
    const { error } = await admin.from("service_enrollments").upsert(
      {
        talent_id: talentId,
        service_type_id: st.id,
        status: "active",
        enrolled_at: now,
      },
      { onConflict: "talent_id, service_type_id" },
    );
    if (error) return { error: error.message };
  }

  return {};
}

export async function ensureOnlyFansEnrollmentForModel(
  modelId: string,
): Promise<{ talentId?: string; error?: string }> {
  const t = await getTranslations("errors.brand");
  const admin = createAdminClient();

  const { data: model, error: modelError } = await admin
    .from("models")
    .select("id, display_name, active")
    .eq("id", modelId)
    .maybeSingle();

  if (modelError || !model) {
    return { error: modelError?.message ?? t("modelNotFound") };
  }

  const talentResult = await getOrCreateTalentForModel(modelId, admin);
  if ("error" in talentResult) {
    return { error: talentResult.error };
  }
  const talentId = talentResult.id;

  const { data: serviceType } = await admin
    .from("service_types")
    .select("id")
    .eq("key", "onlyfans")
    .single();

  if (!serviceType) {
    return { error: t("onlyfansServiceMissing") };
  }

  const status = model.active ? "active" : "inactive";
  const { error: enrollmentError } = await admin.from("service_enrollments").upsert(
    {
      talent_id: talentId,
      service_type_id: serviceType.id,
      status,
      enrolled_at: model.active ? new Date().toISOString() : null,
    },
    { onConflict: "talent_id, service_type_id" },
  );

  if (enrollmentError) {
    return { error: enrollmentError.message };
  }

  return { talentId };
}

async function getOrCreateTalentForModel(
  modelId: string,
  adminClient?: SupabaseClient,
): Promise<{ id: string } | { error: string }> {
  const t = await getTranslations("errors.brand");
  const admin = adminClient ?? createAdminClient();

  const { data: model, error: modelError } = await admin
    .from("models")
    .select(
      "id, profile_id, display_name, stage_name, nationality, city, language, active",
    )
    .eq("id", modelId)
    .maybeSingle();

  if (modelError || !model) {
    return { error: modelError?.message ?? t("modelNotFound") };
  }

  const { data: existingByModel } = await admin
    .from("talents")
    .select("id")
    .eq("linked_model_id", modelId)
    .maybeSingle();

  if (existingByModel) {
    return { id: existingByModel.id };
  }

  let fullName: string | null = null;
  if (model.profile_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", model.profile_id)
      .maybeSingle();
    fullName = profile?.full_name ?? null;
  }

  const { data: talent, error: talentError } = await admin
    .from("talents")
    .insert({
      linked_model_id: modelId,
      legal_name: fullName ?? model.display_name,
      stage_name: model.stage_name,
      display_name: model.display_name,
      location: model.city,
      nationality: model.nationality,
      languages: model.language ? [String(model.language)] : [],
      active: model.active,
    })
    .select("id")
    .single();

  if (talentError || !talent) {
    return { error: talentError?.message ?? t("modelTalentCreateFailed") };
  }

  return { id: talent.id };
}

function mapTalent(row: Record<string, unknown>): Talent {
  return {
    id: String(row.id),
    profileId: null,
    modelId: row.linked_model_id ? String(row.linked_model_id) : null,
    legalName: row.legal_name ? String(row.legal_name) : null,
    stageName: row.stage_name ? String(row.stage_name) : null,
    displayName: String(row.display_name ?? ""),
    preferredUsername: row.preferred_username ? String(row.preferred_username) : null,
    pronunciation: row.pronunciation ? String(row.pronunciation) : null,
    email: null,
    whatsapp: null,
    birthday: null,
    age: typeof row.approved_age === "number" ? row.approved_age : null,
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

export function mapBrandProfile(
  row: Record<string, unknown>,
  displayNameFallback?: string | null,
): BrandProfile {
  const secondaryPositioning = Array.isArray(row.secondary_positioning)
    ? (row.secondary_positioning as unknown[]).map(String).join(", ")
    : null;

  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    displayName: displayNameFallback ?? null,
    pronunciation: null,
    preferredUsername: null,
    alternateUsernames: null,
    age: null,
    location: null,
    nationality: null,
    languages: null,
    occupation: null,
    brandCategory: null,
    niche1: String(row.niche_1 ?? ""),
    niche2: row.niche_2 ? String(row.niche_2) : null,
    niche3: row.niche_3 ? String(row.niche_3) : null,
    primaryPositioning: row.primary_positioning ? String(row.primary_positioning) : null,
    secondaryPositioning,
    customPositioning: null,
    targetCountries: Array.isArray(row.target_countries)
      ? row.target_countries.map(String)
      : null,
    targetCities: Array.isArray(row.target_cities) ? row.target_cities.map(String) : null,
    targetLanguages: Array.isArray(row.target_languages)
      ? row.target_languages.map(String)
      : null,
    targetGender: row.target_gender ? String(row.target_gender) : null,
    targetAgeMin: typeof row.target_age_min === "number" ? row.target_age_min : null,
    targetAgeMax: typeof row.target_age_max === "number" ? row.target_age_max : null,
    targetInterests: Array.isArray(row.target_interests) ? row.target_interests.map(String) : null,
    desiredPartnerships: row.desired_partnerships ? String(row.desired_partnerships) : null,
    desiredFollowerProfile: null,
    marketsToAvoid: Array.isArray(row.markets_to_avoid) ? row.markets_to_avoid.map(String) : null,
    objectives: [],
    instagramAutomationMode: "manual" as AutomationMode,
    xAutomationMode: "manual" as AutomationMode,
    brandStatus: String(row.status ?? "draft"),
    aiGuidance: row.ai_guidance ? String(row.ai_guidance) : null,
    dailyDirective: null,
    defaultLanguages: ["pt-BR"],
    allowAdultPlatformLinks: false,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapEnrollment(row: Record<string, unknown>): ServiceEnrollment {
  const serviceType = row.service_types as { key?: string } | null;
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    serviceTypeId: String(row.service_type_id),
    serviceTypeCode: serviceType?.key,
    status: String(row.status ?? "inactive"),
    startedAt: row.enrolled_at ? String(row.enrolled_at) : null,
    pausedAt: null,
    endedAt: null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
