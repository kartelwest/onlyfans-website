import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AutomationMode, BrandProfile } from "@/types/brand";

export interface UpdateBrandProfileInput {
  displayName?: string;
  pronunciation?: string | null;
  preferredUsername?: string | null;
  alternateUsernames?: string[] | null;
  age?: number | null;
  location?: string | null;
  nationality?: string | null;
  languages?: string[] | null;
  occupation?: string | null;
  brandCategory?: string | null;
  niche1?: string;
  niche2?: string | null;
  niche3?: string | null;
  primaryPositioning?: string | null;
  secondaryPositioning?: string | null;
  customPositioning?: string | null;
  targetCountries?: string[] | null;
  targetCities?: string[] | null;
  targetLanguages?: string[] | null;
  targetGender?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  targetInterests?: string[] | null;
  desiredPartnerships?: string | null;
  desiredFollowerProfile?: string | null;
  marketsToAvoid?: string[] | null;
  objectives?: Record<string, unknown>[];
  instagramAutomationMode?: "manual" | "approval_based" | "controlled_autopilot";
  xAutomationMode?: "manual" | "approval_based" | "controlled_autopilot";
  brandStatus?: string;
  aiGuidance?: string | null;
  defaultLanguages?: string[];
  allowAdultPlatformLinks?: boolean;
}

export async function updateBrandProfile(
  brandProfileId: string,
  input: UpdateBrandProfileInput,
): Promise<{ brandProfile?: BrandProfile; error?: string }> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Não autenticado." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "administrator"].includes(profile.role)) {
    return { error: "Permissão negada." };
  }

  const update: Record<string, unknown> = {};

  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.pronunciation !== undefined) update.pronunciation = input.pronunciation;
  if (input.preferredUsername !== undefined) update.preferred_username = input.preferredUsername;
  if (input.alternateUsernames !== undefined) update.alternate_usernames = input.alternateUsernames;
  if (input.age !== undefined) update.age = input.age;
  if (input.location !== undefined) update.location = input.location;
  if (input.nationality !== undefined) update.nationality = input.nationality;
  if (input.languages !== undefined) update.languages = input.languages;
  if (input.occupation !== undefined) update.occupation = input.occupation;
  if (input.brandCategory !== undefined) update.brand_category = input.brandCategory;
  if (input.niche1 !== undefined) update.niche_1 = input.niche1;
  if (input.niche2 !== undefined) update.niche_2 = input.niche2;
  if (input.niche3 !== undefined) update.niche_3 = input.niche3;
  if (input.primaryPositioning !== undefined) update.primary_positioning = input.primaryPositioning;
  if (input.secondaryPositioning !== undefined) update.secondary_positioning = input.secondaryPositioning;
  if (input.customPositioning !== undefined) update.custom_positioning = input.customPositioning;
  if (input.targetCountries !== undefined) update.target_countries = input.targetCountries;
  if (input.targetCities !== undefined) update.target_cities = input.targetCities;
  if (input.targetLanguages !== undefined) update.target_languages = input.targetLanguages;
  if (input.targetGender !== undefined) update.target_gender = input.targetGender;
  if (input.targetAgeMin !== undefined) update.target_age_min = input.targetAgeMin;
  if (input.targetAgeMax !== undefined) update.target_age_max = input.targetAgeMax;
  if (input.targetInterests !== undefined) update.target_interests = input.targetInterests;
  if (input.desiredPartnerships !== undefined) update.desired_partnerships = input.desiredPartnerships;
  if (input.desiredFollowerProfile !== undefined) update.desired_follower_profile = input.desiredFollowerProfile;
  if (input.marketsToAvoid !== undefined) update.markets_to_avoid = input.marketsToAvoid;
  if (input.objectives !== undefined) update.objectives = input.objectives;
  if (input.instagramAutomationMode !== undefined) update.instagram_automation_mode = input.instagramAutomationMode;
  if (input.xAutomationMode !== undefined) update.x_automation_mode = input.xAutomationMode;
  if (input.brandStatus !== undefined) update.brand_status = input.brandStatus;
  if (input.aiGuidance !== undefined) update.ai_guidance = input.aiGuidance;
  if (input.defaultLanguages !== undefined) update.default_languages = input.defaultLanguages;
  if (input.allowAdultPlatformLinks !== undefined) update.allow_adult_platform_links = input.allowAdultPlatformLinks;

  if (Object.keys(update).length === 0) {
    return { error: "Nenhum campo para atualizar." };
  }

  const { data, error } = await supabase
    .from("brand_profiles")
    .update(update)
    .eq("id", brandProfileId)
    .select()
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Erro ao atualizar perfil de marca." };
  }

  return { brandProfile: mapBrandProfile(data) };
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
    defaultLanguages: Array.isArray(row.default_languages) ? row.default_languages.map(String) : ["pt-BR"],
    allowAdultPlatformLinks: Boolean(row.allow_adult_platform_links),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
