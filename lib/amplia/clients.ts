import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ensureOnlyFansEnrollmentForModel, mapBrandProfile } from "@/lib/brand/talent";
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

  const { data: enrollmentRows, error: enrollmentsError } = await supabase
    .from("service_enrollments")
    .select(
      `
      id,
      status,
      service_type_id,
      service_types ( id, key, category, display_name ),
      talent_id,
      talents!inner (
        id,
        linked_model_id,
        legal_name,
        stage_name,
        display_name,
        preferred_username,
        location,
        nationality,
        active,
        created_at,
        updated_at
      )
    `,
    )
    .eq("status", "active")
    .order("talent_id", { ascending: true });

  if (enrollmentsError) {
    console.error("Erro ao carregar matrículas Amplia:", enrollmentsError);
    return { clients: [], stats: zeroStats };
  }

  type EnrollmentItem = {
    talents:
      | (Record<string, unknown> & { linked_model_id?: string | null })
      | (Record<string, unknown> & { linked_model_id?: string | null })[];
    service_types:
      | { key?: string; category?: string; display_name?: string }
      | { key?: string; category?: string; display_name?: string }[];
  };

  function first<T>(value: T | T[] | null | undefined): T | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }

  const talentsById = new Map<
    string,
    {
      talent: Record<string, unknown> & { linked_model_id?: string | null };
      hasOnlyFans: boolean;
      hasBrandGrowth: boolean;
      hasBrandGrowthInstagram: boolean;
      hasBrandGrowthX: boolean;
    }
  >();

  const modelIds = new Set<string>();

  for (const raw of (enrollmentRows ?? []) as unknown as EnrollmentItem[]) {
    const talent = first(raw.talents);
    if (!talent) continue;
    const serviceType = first(raw.service_types);
    if (!serviceType) continue;

    const id = String(talent.id);
    const entry = talentsById.get(id) ?? {
      talent,
      hasOnlyFans: false,
      hasBrandGrowth: false,
      hasBrandGrowthInstagram: false,
      hasBrandGrowthX: false,
    };

    const category = serviceType.category ?? "";
    const key = serviceType.key ?? "";

    if (category === "onlyfans_track" || key === "onlyfans") {
      entry.hasOnlyFans = true;
    }
    if (category === "brand_growth") {
      entry.hasBrandGrowth = true;
      if (key === "brand_growth_instagram") entry.hasBrandGrowthInstagram = true;
      if (key === "brand_growth_x") entry.hasBrandGrowthX = true;
    }

    talentsById.set(id, entry);

    if (talent.linked_model_id) {
      modelIds.add(String(talent.linked_model_id));
    }
  }

  const talentIds = Array.from(talentsById.keys());

  const [modelsResult, brandProfilesResult, platformsResult] = await Promise.all([
    modelIds.size > 0
      ? supabase
          .from("models")
          .select(
            "id, display_name, stage_name, city, email, whatsapp, profile_photo_url, active, created_at, updated_at, profile:profiles!profile_id ( full_name )",
          )
          .in("id", Array.from(modelIds))
      : { data: [], error: null },
    supabase.from("brand_profiles").select("*").in("talent_id", talentIds),
    modelIds.size > 0
      ? supabase.from("model_platforms").select("*").in("model_id", Array.from(modelIds))
      : { data: [], error: null },
  ]);

  if (modelsResult.error) {
    console.error("Erro ao carregar modelos:", modelsResult.error);
  }
  if (brandProfilesResult.error) {
    console.error("Erro ao carregar perfis de marca:", brandProfilesResult.error);
  }
  if (platformsResult.error) {
    console.error("Erro ao carregar plataformas:", platformsResult.error);
  }

  const modelMap = new Map(
    (modelsResult.data ?? []).map((m: Record<string, unknown>) => [String(m.id), m]),
  );

  const brandProfileMap = new Map(
    (brandProfilesResult.data ?? []).map((bp: Record<string, unknown>) => [
      String(bp.talent_id),
      bp,
    ]),
  );

  const platformsByModel = new Map<string, Record<string, unknown>[]>();
  for (const p of (platformsResult.data ?? []) as Record<string, unknown>[]) {
    const list = platformsByModel.get(String(p.model_id)) ?? [];
    list.push(p);
    platformsByModel.set(String(p.model_id), list);
  }

  const clients: AmpliaClient[] = [];

  for (const {
    talent,
    hasOnlyFans,
    hasBrandGrowth,
    hasBrandGrowthInstagram,
    hasBrandGrowthX,
  } of talentsById.values()) {
    if (!hasBrandGrowth) {
      continue;
    }

    const modelId = talent.linked_model_id ? String(talent.linked_model_id) : null;
    const model = modelId ? (modelMap.get(modelId) as Record<string, unknown> | undefined) : null;
    const type = hasOnlyFans ? "model" : "brand_only";

    const sourceRow: Record<string, unknown> = {
      id: model?.id ?? talent.id,
      display_name: talent.display_name,
      stage_name: talent.stage_name,
      email: model?.email ?? null,
      whatsapp: model?.whatsapp ?? null,
      profile_photo_url: model?.profile_photo_url ?? null,
      city: model?.city ?? talent.location ?? null,
      location: model?.city ?? talent.location ?? null,
      active: talent.active,
      created_at: talent.created_at,
      updated_at: talent.updated_at,
    };

    const rawProfiles = model?.profile as unknown as
      | { full_name: string | null }[]
      | { full_name: string | null }
      | null;
    const profile = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles;

    const brandProfile = brandProfileMap.get(String(talent.id));
    const brandStatus = (brandProfile?.status as string) ?? "not_requested";

    const platforms = modelId ? (platformsByModel.get(modelId) ?? []) : [];
    const connectedInstagram =
      hasBrandGrowthInstagram ||
      platforms.some(
        (p) =>
          String(p.platform).toLowerCase() === "instagram" &&
          ["active", "connected", "verified"].includes(String(p.account_status).toLowerCase()),
      );
    const connectedX =
      hasBrandGrowthX ||
      platforms.some(
        (p) =>
          String(p.platform).toLowerCase() === "x" &&
          ["active", "connected", "verified"].includes(String(p.account_status).toLowerCase()),
      );

    clients.push(
      buildClient(
        sourceRow,
        type,
        String(talent.id),
        profile,
        brandStatus,
        connectedInstagram,
        connectedX,
      ),
    );
  }

  clients.sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR", { sensitivity: "base" }));

  const stats = {
    activeSocialModels: clients.filter((c) => c.type === "model").length,
    brandGrowthOnlyClients: clients.filter((c) => c.type === "brand_only").length,
    connectedInstagram: clients.filter((c) => c.connectedInstagram).length,
    awaitingLaunch: clients.filter((c) => ["draft", "planning", "not_requested"].includes(c.brandStatus)).length,
    awaitingAuthorization: clients.filter((c) => ["awaiting_connection", "awaiting_verification"].includes(c.brandStatus)).length,
    contentAwaitingApproval: 0,
    postsScheduledToday: 0,
    playbookCompletedToday: 0,
    playbookPendingToday: 0,
    publishingFailures24h: 0,
    accountsNeedingAttention: clients.filter(
      (c) => ["restricted", "suspended", "authorization_expired"].includes(c.brandStatus),
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
      profile:profiles!profile_id ( full_name )
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

    const rawProfile = row.profile as unknown as
      | { full_name: string | null }[]
      | { full_name: string | null }
      | null;
    profile = Array.isArray(rawProfile) ? rawProfile[0] : (rawProfile ?? undefined);
  } else {
    const { data: talentRow } = await supabase
      .from("talents")
      .select(
        `
        id,
        linked_model_id,
        legal_name,
        stage_name,
        display_name,
        preferred_username,
        location,
        active,
        created_at,
        updated_at
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (!talentRow) {
      return { error: "Cliente não encontrado." };
    }

    const row = talentRow as unknown as Record<string, unknown>;
    const linkedModelId = row.linked_model_id ? String(row.linked_model_id) : null;
    let model: Record<string, unknown> | null = null;
    let modelProfile: { full_name: string | null } | undefined;
    if (linkedModelId) {
      const { data: linkedModel } = await supabase
        .from("models")
        .select("id, city, profile_photo_url, email, whatsapp, active, created_at, updated_at, profile:profiles!profile_id ( full_name )")
        .eq("id", linkedModelId)
        .maybeSingle();
      model = (linkedModel as Record<string, unknown>) ?? null;

      const rawModelProfiles = model?.profile as unknown as
        | { full_name: string | null }[]
        | { full_name: string | null }
        | null;
      modelProfile = Array.isArray(rawModelProfiles)
        ? rawModelProfiles[0]
        : (rawModelProfiles ?? undefined);
    }

    sourceRow = {
      id: model?.id ?? row.id,
      display_name: row.display_name,
      stage_name: row.stage_name,
      email: model?.email ?? null,
      whatsapp: model?.whatsapp ?? null,
      profile_photo_url: model?.profile_photo_url ?? null,
      city: model?.city ?? row.location ?? null,
      location: row.location ?? model?.city ?? null,
      active: model?.active ?? row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    talentId = String(row.id);

    profile = modelProfile ?? (row.legal_name ? { full_name: String(row.legal_name) } : undefined);
  }

  if (!talentId) {
    return { error: "Não foi possível identificar o talento." };
  }

  const [brandProfileResult, platformsResult, consentsResult, boundariesResult, enrollmentsResult] =
    await Promise.all([
      supabase.from("brand_profiles").select("*").eq("talent_id", talentId).maybeSingle(),
      supabase.from("model_platforms").select("*").eq("model_id", sourceRow.id as string),
      supabase.from("client_consents").select("consent_type, granted").eq("talent_id", talentId),
      supabase.from("client_boundaries").select("*").eq("talent_id", talentId).maybeSingle(),
      supabase
        .from("service_enrollments")
        .select("service_types(key)")
        .eq("talent_id", talentId)
        .eq("status", "active"),
    ]);

  const hasOnlyFans = (enrollmentsResult.data ?? []).some((e: Record<string, unknown>) => {
    const serviceTypes = e.service_types as { key?: string }[] | { key?: string } | null;
    const first = Array.isArray(serviceTypes) ? serviceTypes[0] : serviceTypes;
    return first?.key === "onlyfans";
  });

  if (type === "brand_only" && hasOnlyFans) {
    type = "model";
  }

  const brandProfile = brandProfileResult.data as Record<string, unknown> | null;
  const platforms = (platformsResult.data ?? []) as Record<string, unknown>[];
  const consents = (consentsResult.data ?? []) as { consent_type: string; granted: boolean }[];
  const boundaries = boundariesResult.data as Record<string, unknown> | null;

  const brandStatus = (brandProfile?.status as string) ?? "not_requested";

  const connectedInstagram = platforms.some(
    (p) =>
      String(p.platform).toLowerCase() === "instagram" &&
      ["active", "connected", "verified"].includes(String(p.account_status).toLowerCase()),
  );
  const connectedX = platforms.some(
    (p) =>
      String(p.platform).toLowerCase() === "x" &&
      ["active", "connected", "verified"].includes(String(p.account_status).toLowerCase()),
  );

  const client = buildClient(
    sourceRow,
    type,
    talentId,
    profile ?? null,
    brandStatus,
    connectedInstagram,
    connectedX,
  );

  return {
    client: {
      ...client,
      talent: null,
      brandProfile: brandProfile ? mapBrandProfile(brandProfile, client.displayName) : null,
      socialAccounts: platforms.map(mapSocialAccount),
      consents: Object.fromEntries(consents.map((c) => [c.consent_type, c.granted])),
      boundaries: boundaries
        ? {
            prohibitedSubjects: (boundaries.prohibited_subjects as string[]) ?? [],
            prohibitedWords: (boundaries.prohibited_words as string[]) ?? [],
            privateDetailsNeverReveal: (boundaries.private_details_never_reveal as string[]) ?? [],
            neverGenerateNudity: false,
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
  brandStatus: string,
  connectedInstagram: boolean,
  connectedX: boolean,
): AmpliaClient {
  return {
    id: row.id as string,
    talentId,
    type,
    displayName: String(row.display_name ?? ""),
    stageName: (row.stage_name as string) ?? null,
    fullName: profile?.full_name ?? null,
    location: ((row.city ?? row.location) as string) ?? null,
    email: (row.email as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    profilePhotoUrl: (row.profile_photo_url as string) ?? null,
    active: row.active as boolean,
    brandStatus,
    connectedInstagram,
    connectedX,
    pendingApprovals: 0,
    scheduledToday: 0,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapSocialAccount(row: Record<string, unknown>): SocialAccount {
  return {
    id: String(row.id),
    talentId: String(row.model_id),
    platform: String(row.platform).toLowerCase() as Platform,
    username: row.username ? String(row.username) : null,
    displayName: row.username ? String(row.username) : null,
    profileUrl: row.profile_url ? String(row.profile_url) : null,
    bio: null,
    profilePictureUrl: null,
    bannerUrl: null,
    isProfessional: false,
    status: String(row.account_status) as SocialAccount["status"],
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
