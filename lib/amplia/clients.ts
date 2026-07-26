import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ensureOnlyFansEnrollmentForModel } from "@/lib/brand/talent";
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

const zeroStats = {
  activeSocialModels: 0,
  brandGrowthOnlyClients: 0,
  connectedInstagram: 0,
  awaitingLaunch: 0,
  awaitingAuthorization: 0,
  contentAwaitingApproval: 0,
  postsScheduledToday: 0,
  playbookCompletedToday: 0,
  playbookPendingToday: 0,
  publishingFailures24h: 0,
  accountsNeedingAttention: 0,
  contentShortages: 0,
  recentFollowerGrowth: 0,
  criticalAlerts: 0,
  estimatedAICostMonth: 0,
};

export async function getAmpliaClients(): Promise<{
  clients: AmpliaClient[];
  stats: typeof zeroStats;
}> {
  const supabase = await createClient();

  const { data: serviceTypes, error: serviceTypesError } = await supabase
    .from("service_types")
    .select("id, code");

  if (serviceTypesError) {
    console.error("Erro ao carregar tipos de serviço:", serviceTypesError);
    return { clients: [], stats: zeroStats };
  }

  const onlyfansTypeId = serviceTypes?.find((s) => (s as { code?: string }).code === "onlyfans")?.id as string | undefined;
  const brandGrowthTypeId = serviceTypes?.find((s) => (s as { code?: string }).code === "brand_growth")?.id as string | undefined;

  const relevantTypeIds = [onlyfansTypeId, brandGrowthTypeId].filter(Boolean) as string[];
  if (relevantTypeIds.length === 0) {
    return { clients: [], stats: zeroStats };
  }

  // Canonical source of truth for Amplia visibility:
  // a talent appears in the regular models area when it has an ACTIVE
  // service enrollment for either OnlyFans or Brand Growth.
  const { data: enrollmentRows, error: enrollmentsError } = await supabase
    .from("service_enrollments")
    .select(
      `
      id,
      status,
      service_type_id,
      service_types ( code ),
      talent_id,
      talents!inner (
        id,
        model_id,
        profile_id,
        legal_name,
        stage_name,
        display_name,
        preferred_username,
        email,
        whatsapp,
        location,
        nationality,
        active,
        created_at,
        updated_at,
        models!model_id ( id, profile_photo_url, city, active ),
        profiles!profile_id ( full_name )
      )
    `,
    )
    .in("service_type_id", relevantTypeIds)
    .eq("status", "active")
    .order("talent_id", { ascending: true });

  if (enrollmentsError) {
    console.error("Erro ao carregar matrículas Amplia:", enrollmentsError);
    return { clients: [], stats: zeroStats };
  }

  type ServiceTypeCode = "onlyfans" | "brand_growth";
  type EnrollmentItem = {
    talents: (Record<string, unknown> & {
      models: Record<string, unknown>[] | null;
      profiles: { full_name: string | null }[] | null;
    })[];
    service_types: { code?: ServiceTypeCode }[];
  };

  const talentsById = new Map<
    string,
    {
      talent: (EnrollmentItem["talents"][number]);
      hasOnlyFans: boolean;
      hasBrandGrowth: boolean;
    }
  >();

  for (const raw of (enrollmentRows ?? []) as unknown as EnrollmentItem[]) {
    const talent = raw.talents[0];
    if (!talent) continue;
    const code = raw.service_types?.[0]?.code;
    const id = String(talent.id);
    const entry = talentsById.get(id) ?? { talent, hasOnlyFans: false, hasBrandGrowth: false };
    if (code === "onlyfans") entry.hasOnlyFans = true;
    if (code === "brand_growth") entry.hasBrandGrowth = true;
    talentsById.set(id, entry);
  }

  const talentIds = Array.from(talentsById.keys());

  const [brandProfilesResult, socialAccountsResult, approvalCountsResult, scheduledTodayResult] =
    await Promise.all([
      supabase.from("brand_profiles").select("*").in("talent_id", talentIds),
      supabase.from("social_accounts").select("*").in("talent_id", talentIds),
      supabase
        .from("content_items")
        .select("talent_id, id")
        .in("status", ["awaiting_client_approval", "awaiting_agency_approval"])
        .in("talent_id", talentIds),
      (() => {
        const today = new Date().toISOString().split("T")[0];
        return supabase
          .from("content_items")
          .select("talent_id, id")
          .eq("status", "scheduled")
          .gte("scheduled_for", `${today}T00:00:00`)
          .lt("scheduled_for", `${today}T23:59:59`);
      })(),
    ]);

  if (brandProfilesResult.error) {
    console.error("Erro ao carregar perfis de marca:", brandProfilesResult.error);
  }
  if (socialAccountsResult.error) {
    console.error("Erro ao carregar contas sociais:", socialAccountsResult.error);
  }
  if (approvalCountsResult.error) {
    console.error("Erro ao carregar aprovações pendentes:", approvalCountsResult.error);
  }
  if (scheduledTodayResult.error) {
    console.error("Erro ao carregar agendamentos de hoje:", scheduledTodayResult.error);
  }

  const brandProfileMap = new Map(
    (brandProfilesResult.data ?? []).map((bp) => [String(bp.talent_id), bp as Record<string, unknown>]),
  );

  const socialAccountsByTalent = new Map<string, Record<string, unknown>[]>();
  for (const acc of (socialAccountsResult.data ?? []) as Record<string, unknown>[]) {
    const list = socialAccountsByTalent.get(String(acc.talent_id)) ?? [];
    list.push(acc);
    socialAccountsByTalent.set(String(acc.talent_id), list);
  }

  const approvalsByTalent = new Map<string, number>();
  for (const item of (approvalCountsResult.data ?? []) as { talent_id: string; id: string }[]) {
    approvalsByTalent.set(item.talent_id, (approvalsByTalent.get(item.talent_id) ?? 0) + 1);
  }

  const scheduledByTalent = new Map<string, number>();
  for (const item of (scheduledTodayResult.data ?? []) as { talent_id: string; id: string }[]) {
    scheduledByTalent.set(item.talent_id, (scheduledByTalent.get(item.talent_id) ?? 0) + 1);
  }

  const clients: AmpliaClient[] = [];

  for (const { talent, hasOnlyFans } of talentsById.values()) {
    const model = (talent.models?.[0] as Record<string, unknown> | undefined) ?? null;
    const talentId = String(talent.id);
    const type = hasOnlyFans ? "model" : "brand_only";

    // Source fields are taken from the canonical talent row. For models we
    // overlay model-only fields (profile photo, city) while keeping the talent
    // identity as the primary key.
    const sourceRow: Record<string, unknown> = {
      id: model?.id ?? talentId,
      display_name: talent.display_name,
      stage_name: talent.stage_name,
      email: talent.email,
      whatsapp: talent.whatsapp,
      profile_photo_url: model?.profile_photo_url ?? null,
      city: model?.city ?? null,
      location: talent.location,
      active: talent.active,
      created_at: talent.created_at,
      updated_at: talent.updated_at,
    };

    const profile = (talent.profiles?.[0] as { full_name: string | null } | undefined) ?? null;
    const brandProfile = brandProfileMap.get(talentId);
    const accounts = socialAccountsByTalent.get(talentId) ?? [];

    clients.push(
      buildClient(
        sourceRow,
        type,
        talentId,
        profile,
        brandProfile,
        accounts,
        approvalsByTalent,
        scheduledByTalent,
      ),
    );
  }

  clients.sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR", { sensitivity: "base" }));

  const stats = {
    activeSocialModels: Array.from(talentsById.values()).filter((t) => t.hasOnlyFans).length,
    brandGrowthOnlyClients: Array.from(talentsById.values()).filter(
      (entry) => !entry.hasOnlyFans && entry.hasBrandGrowth,
    ).length,
    connectedInstagram: clients.filter((c) => c.connectedInstagram).length,
    awaitingLaunch: clients.filter(
      (c) => c.brandStatus === "planning" || c.brandStatus === "not_requested",
    ).length,
    awaitingAuthorization: clients.filter(
      (c) => c.brandStatus === "awaiting_connection" || c.brandStatus === "awaiting_verification",
    ).length,
    contentAwaitingApproval: clients.reduce((sum, c) => sum + c.pendingApprovals, 0),
    postsScheduledToday: clients.reduce((sum, c) => sum + c.scheduledToday, 0),
    playbookCompletedToday: 0,
    playbookPendingToday: 0,
    publishingFailures24h: 0,
    accountsNeedingAttention: clients.filter(
      (c) =>
        c.brandStatus === "restricted" ||
        c.brandStatus === "suspended" ||
        c.brandStatus === "authorization_expired",
    ).length,
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

  let talentId: string | null = null;
  let type: "model" | "brand_only" = "brand_only";
  let sourceRow: Record<string, unknown>;
  let profile: { full_name: string | null } | undefined;

  if (modelRow) {
    type = "model";

    const { talentId: maybeTalentId, error: ensureError } = await ensureOnlyFansEnrollmentForModel(id);
    if (ensureError || !maybeTalentId) {
      return { error: ensureError ?? "Não foi possível preparar o talento da modelo." };
    }
    talentId = maybeTalentId;

    const row = modelRow as unknown as Record<string, unknown>;
    sourceRow = {
      id: row.id,
      display_name: row.display_name,
      stage_name: row.stage_name,
      email: row.email,
      whatsapp: row.whatsapp,
      profile_photo_url: row.profile_photo_url,
      city: row.city,
      location: row.city,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const rawProfile = row.profiles as unknown as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    profile = Array.isArray(rawProfile) ? rawProfile[0] : (rawProfile ?? undefined);
  } else {
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
        profiles ( full_name ),
        models!model_id ( id, profile_photo_url, city, active )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (!talentRow) {
      return { error: "Cliente não encontrado." };
    }

    const row = talentRow as unknown as Record<string, unknown>;
    const linkedModels = row.models as unknown as
      | Record<string, unknown>[]
      | undefined;
    const linkedModel = linkedModels?.[0];

    sourceRow = {
      id: linkedModel?.id ?? row.id,
      display_name: row.display_name,
      stage_name: row.stage_name,
      email: row.email,
      whatsapp: row.whatsapp,
      profile_photo_url: linkedModel?.profile_photo_url ?? null,
      city: linkedModel?.city ?? null,
      location: row.location ?? linkedModel?.city ?? null,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    talentId = row.id as string;

    const rawProfile = row.profiles as unknown as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    profile = Array.isArray(rawProfile) ? rawProfile[0] : (rawProfile ?? undefined);
  }

  const [{ data: brandProfile }, { data: socialAccounts }, { data: consents }, { data: boundaries }] =
    await Promise.all([
      supabase.from("brand_profiles").select("*").eq("talent_id", talentId).maybeSingle(),
      supabase.from("social_accounts").select("*").eq("talent_id", talentId),
      supabase.from("client_consents").select("consent_key, granted").eq("talent_id", talentId),
      supabase.from("client_boundaries").select("*").eq("talent_id", talentId).maybeSingle(),
    ]);

  const client = buildClient(
    sourceRow,
    type,
    talentId,
    profile ?? null,
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
    connectedInstagram:
      instagram?.status === "connected" || instagram?.status === "active" || false,
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
    instagramAutomationMode:
      (row.instagram_automation_mode as "manual" | "approval_based" | "controlled_autopilot") ??
      "manual",
    xAutomationMode:
      (row.x_automation_mode as "manual" | "approval_based" | "controlled_autopilot") ?? "manual",
    brandStatus: String(row.brand_status ?? "planning"),
    aiGuidance: row.ai_guidance ? String(row.ai_guidance) : null,
    dailyDirective: row.daily_directive ? String(row.daily_directive) : null,
    defaultLanguages: Array.isArray(row.default_languages)
      ? row.default_languages.map(String)
      : ["pt-BR"],
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
