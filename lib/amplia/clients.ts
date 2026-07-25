import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandProfile, Platform, SocialAccount, Talent } from "@/types/brand";

export interface AmpliaClient {
  id: string;
  talentId: string;
  type: "model" | "brand_only";
  displayName: string;
  stageName: string | null;
  fullName: string | null;
  location: string | null;
  email: string | null;
  whatsapp: string | null;
  profilePhotoUrl: string | null;
  active: boolean;
  brandStatus: string;
  connectedInstagram: boolean;
  connectedX: boolean;
  pendingApprovals: number;
  scheduledToday: number;
  createdAt: string;
  updatedAt: string;
}

export interface AmpliaClientDetail extends AmpliaClient {
  talent: Talent | null;
  brandProfile: BrandProfile | null;
  socialAccounts: SocialAccount[];
  consents: Record<string, boolean>;
  boundaries: {
    prohibitedSubjects: string[];
    prohibitedWords: string[];
    privateDetailsNeverReveal: string[];
    neverGenerateNudity: boolean;
  } | null;
}

export async function getAmpliaClients(): Promise<{
  clients: AmpliaClient[];
  stats: {
    activeSocialModels: number;
    brandGrowthOnlyClients: number;
    connectedInstagram: number;
    awaitingLaunch: number;
    awaitingAuthorization: number;
    contentAwaitingApproval: number;
    postsScheduledToday: number;
    playbookCompletedToday: number;
    playbookPendingToday: number;
    publishingFailures24h: number;
    accountsNeedingAttention: number;
    contentShortages: number;
    recentFollowerGrowth: number;
    criticalAlerts: number;
    estimatedAICostMonth: number;
  };
}> {
  const supabase = await createClient();

  // Active models (source of truth: models.active)
  const { data: modelRows } = await supabase
    .from("models")
    .select(
      `
      id,
      profile_id,
      talent_id,
      display_name,
      stage_name,
      city,
      email,
      whatsapp,
      profile_photo_url,
      active,
      created_at,
      updated_at,
      profiles ( full_name )
    `,
    )
    .eq("active", true)
    .order("display_name", { ascending: true });

  // Brand-Growth-only clients (talents with no linked model)
  const { data: bgOnlyRows } = await supabase
    .from("talents")
    .select(
      `
      id,
      model_id,
      profile_id,
      display_name,
      stage_name,
      location,
      email,
      whatsapp,
      active,
      created_at,
      updated_at,
      profiles ( full_name )
    `,
    )
    .is("model_id", null)
    .eq("active", true)
    .order("display_name", { ascending: true });

  // Fetch brand profiles and social accounts for all relevant talent_ids.
  const talentIds = new Set<string>();
  for (const row of modelRows ?? []) {
    if (row.talent_id) talentIds.add(row.talent_id as string);
  }
  for (const row of bgOnlyRows ?? []) {
    talentIds.add(row.id as string);
  }

  const { data: brandProfiles } = await supabase
    .from("brand_profiles")
    .select("*")
    .in("talent_id", Array.from(talentIds));

  const { data: socialAccounts } = await supabase
    .from("social_accounts")
    .select("*")
    .in("talent_id", Array.from(talentIds));

  const { data: approvalCounts } = await supabase
    .from("content_items")
    .select("talent_id, id")
    .in(
      "status",
      ["awaiting_client_approval", "awaiting_agency_approval"],
    )
    .in("talent_id", Array.from(talentIds));

  const today = new Date().toISOString().split("T")[0];
  const { data: scheduledToday } = await supabase
    .from("content_items")
    .select("talent_id, id")
    .eq("status", "scheduled")
    .gte("scheduled_for", `${today}T00:00:00`)
    .lt("scheduled_for", `${today}T23:59:59`);

  const brandProfileMap = new Map(
    (brandProfiles ?? []).map((bp) => [bp.talent_id as string, bp]),
  );

  const socialAccountsByTalent = new Map<string, typeof socialAccounts>();
  for (const acc of socialAccounts ?? []) {
    const list = socialAccountsByTalent.get(acc.talent_id as string) ?? [];
    list.push(acc);
    socialAccountsByTalent.set(acc.talent_id as string, list);
  }

  const approvalsByTalent = new Map<string, number>();
  for (const item of approvalCounts ?? []) {
    approvalsByTalent.set(
      item.talent_id as string,
      (approvalsByTalent.get(item.talent_id as string) ?? 0) + 1,
    );
  }

  const scheduledByTalent = new Map<string, number>();
  for (const item of scheduledToday ?? []) {
    scheduledByTalent.set(
      item.talent_id as string,
      (scheduledByTalent.get(item.talent_id as string) ?? 0) + 1,
    );
  }

  const clients: AmpliaClient[] = [];

  for (const row of modelRows ?? []) {
    const profile = (row.profiles as unknown) as { full_name: string | null } | null;
    const talentId = (row.talent_id as string) ?? (row.id as string);
    const bp = brandProfileMap.get(talentId);
    const accounts = socialAccountsByTalent.get(talentId) ?? [];
    clients.push(buildClient(row, "model", talentId, profile, bp, accounts, approvalsByTalent, scheduledByTalent));
  }

  for (const row of bgOnlyRows ?? []) {
    const profile = (row.profiles as unknown) as { full_name: string | null } | null;
    const talentId = row.id as string;
    const bp = brandProfileMap.get(talentId);
    const accounts = socialAccountsByTalent.get(talentId) ?? [];
    clients.push(buildClient(row, "brand_only", talentId, profile, bp, accounts, approvalsByTalent, scheduledByTalent));
  }

  const stats = {
    activeSocialModels: clients.filter((c) => c.type === "model").length,
    brandGrowthOnlyClients: clients.filter((c) => c.type === "brand_only").length,
    connectedInstagram: clients.filter((c) => c.connectedInstagram).length,
    awaitingLaunch: clients.filter((c) => c.brandStatus === "planning" || c.brandStatus === "not_requested").length,
    awaitingAuthorization: clients.filter((c) => c.brandStatus === "awaiting_connection" || c.brandStatus === "awaiting_verification").length,
    contentAwaitingApproval: clients.reduce((sum, c) => sum + c.pendingApprovals, 0),
    postsScheduledToday: clients.reduce((sum, c) => sum + c.scheduledToday, 0),
    playbookCompletedToday: 0,
    playbookPendingToday: 0,
    publishingFailures24h: 0,
    accountsNeedingAttention: clients.filter((c) => c.brandStatus === "restricted" || c.brandStatus === "suspended" || c.brandStatus === "authorization_expired").length,
    contentShortages: 0,
    recentFollowerGrowth: 0,
    criticalAlerts: 0,
    estimatedAICostMonth: 0,
  };

  return { clients, stats };
}

export async function getAmpliaClientById(
  id: string,
): Promise<{ client?: AmpliaClientDetail; error?: string }> {
  const supabase = await createClient();

  // id can be either a model id or a talent id. Try model first.
  const { data: modelRow } = await supabase
    .from("models")
    .select(
      `
      id,
      talent_id,
      display_name,
      stage_name,
      city,
      email,
      whatsapp,
      profile_photo_url,
      active,
      created_at,
      updated_at,
      profiles ( full_name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  const { data: talentRow } = await supabase
    .from("talents")
    .select(
      `
      id,
      model_id,
      profile_id,
      display_name,
      stage_name,
      location,
      email,
      whatsapp,
      active,
      created_at,
      updated_at,
      profiles ( full_name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  const row = modelRow ?? talentRow;
  if (!row) {
    return { error: "Cliente não encontrado." };
  }

  const talentId = modelRow ? ((modelRow.talent_id as string) ?? modelRow.id) : talentRow!.id;

  // If an active model has no talent yet, create the talent and brand profile.
  if (modelRow && !modelRow.talent_id) {
    await ensureTalentForModel(
      modelRow,
      ((modelRow.profiles as unknown) as { full_name: string | null } | null)?.full_name ?? null,
    );
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("talent_id", talentId)
    .maybeSingle();

  const { data: socialAccounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("talent_id", talentId);

  const { data: consents } = await supabase
    .from("client_consents")
    .select("consent_key, granted")
    .eq("talent_id", talentId);

  const { data: boundaries } = await supabase
    .from("client_boundaries")
    .select("*")
    .eq("talent_id", talentId)
    .maybeSingle();

  const client = buildClient(
    row,
    modelRow ? "model" : "brand_only",
    talentId,
    ((row.profiles as unknown) as { full_name: string | null } | null) ?? null,
    brandProfile,
    socialAccounts ?? [],
    new Map(),
    new Map(),
  );

  return {
    client: {
      ...client,
      talent: null,
      brandProfile: brandProfile ? mapBrandProfile(brandProfile) : null,
      socialAccounts: (socialAccounts ?? []).map(mapSocialAccount),
      consents: Object.fromEntries((consents ?? []).map((c) => [c.consent_key, c.granted])),
      boundaries: boundaries
        ? {
            prohibitedSubjects: boundaries.prohibited_subjects as string[],
            prohibitedWords: boundaries.prohibited_words as string[],
            privateDetailsNeverReveal: boundaries.private_details_never_reveal as string[],
            neverGenerateNudity: Boolean(boundaries.never_generate_nudity),
          }
        : null,
    },
  };
}

async function ensureTalentForModel(
  model: Record<string, unknown>,
  fullName: string | null,
): Promise<string> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: existing } = await supabase
    .from("talents")
    .select("id")
    .eq("model_id", model.id as string)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("models")
      .update({ talent_id: existing.id })
      .eq("id", model.id as string);
    return existing.id;
  }

  const { data: talent, error } = await admin
    .from("talents")
    .insert({
      profile_id: (model.profile_id as string) ?? null,
      model_id: model.id as string,
      legal_name: fullName,
      stage_name: (model.stage_name as string) ?? null,
      display_name: (model.display_name as string) ?? "",
      email: (model.email as string) ?? null,
      whatsapp: (model.whatsapp as string) ?? null,
      location: (model.city as string) ?? null,
      active: true,
    })
    .select()
    .single();

  if (error || !talent) {
    throw new Error(error?.message ?? "Erro ao criar talento.");
  }

  await admin.from("brand_profiles").insert({
    talent_id: talent.id,
    display_name: (model.display_name as string) ?? "",
    niche_1: "lifestyle",
  });

  await admin
    .from("models")
    .update({ talent_id: talent.id })
    .eq("id", model.id as string);

  return talent.id;
}

function buildClient(
  row: Record<string, unknown>,
  type: "model" | "brand_only",
  talentId: string,
  profile: { full_name: string | null } | null,
  brandProfile: Record<string, unknown> | undefined,
  accounts: Record<string, unknown>[],
  approvalsByTalent: Map<string, number>,
  scheduledByTalent: Map<string, number>,
): AmpliaClient {
  const instagram = accounts.find((a) => a.platform === "instagram");
  const xAccount = accounts.find((a) => a.platform === "x");
  const brandStatus = brandProfile ? (brandProfile.brand_status as string) : "not_requested";

  return {
    id: row.id as string,
    talentId,
    type,
    displayName: (row.display_name as string) ?? "",
    stageName: (row.stage_name as string) ?? null,
    fullName: profile?.full_name ?? null,
    location: ((row.city ?? row.location) as string) ?? null,
    email: (row.email as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    profilePhotoUrl: (row.profile_photo_url as string) ?? null,
    active: row.active as boolean,
    brandStatus,
    connectedInstagram: instagram?.status === "connected" || instagram?.status === "active" || false,
    connectedX: xAccount?.status === "connected" || xAccount?.status === "active" || false,
    pendingApprovals: approvalsByTalent.get(talentId) ?? 0,
    scheduledToday: scheduledByTalent.get(talentId) ?? 0,
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
    instagramAutomationMode: (row.instagram_automation_mode as "manual" | "approval_based" | "controlled_autopilot") ?? "manual",
    xAutomationMode: (row.x_automation_mode as "manual" | "approval_based" | "controlled_autopilot") ?? "manual",
    brandStatus: String(row.brand_status ?? "planning"),
    aiGuidance: row.ai_guidance ? String(row.ai_guidance) : null,
    dailyDirective: row.daily_directive ? String(row.daily_directive) : null,
    defaultLanguages: Array.isArray(row.default_languages) ? row.default_languages.map(String) : ["pt-BR"],
    allowAdultPlatformLinks: Boolean(row.allow_adult_platform_links),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapSocialAccount(row: Record<string, unknown>): SocialAccount {
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    platform: row.platform as Platform,
    username: row.username ? String(row.username) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    profileUrl: row.profile_url ? String(row.profile_url) : null,
    bio: row.bio ? String(row.bio) : null,
    profilePictureUrl: row.profile_picture_url ? String(row.profile_picture_url) : null,
    bannerUrl: row.banner_url ? String(row.banner_url) : null,
    isProfessional: Boolean(row.is_professional),
    status: String(row.status) as SocialAccount["status"],
    followerCount: typeof row.follower_count === "number" ? row.follower_count : 0,
    followingCount: typeof row.following_count === "number" ? row.following_count : 0,
    postCount: typeof row.post_count === "number" ? row.post_count : 0,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
