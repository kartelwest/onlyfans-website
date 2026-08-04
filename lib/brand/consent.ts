import { getTranslations } from "next-intl/server";
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ClientConsent } from "@/types/brand";

export type ConsentKey =
  | "legal_name_use"
  | "face_use"
  | "voice_use"
  | "ai_generated_image_use"
  | "ai_enhanced_image_use"
  | "ai_generated_video_use"
  | "location_age_relationship_disclosure"
  | "links_to_adult_platforms"
  | "content_repurposing"
  | "cross_platform_publishing"
  | "automatic_publishing"
  | "ai_generated_replies"
  | "data_use_for_strategy";

export async function getClientConsents(talentId: string): Promise<ClientConsent[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("client_consents")
    .select("*")
    .eq("talent_id", talentId)
    .order("consent_key", { ascending: true });

  return (data ?? []).map(mapConsent);
}

export async function updateConsent(
  talentId: string,
  consentKey: ConsentKey,
  granted: boolean,
  notes?: string,
): Promise<{ error?: string }> {
  const t = await getTranslations("errors.brand");
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: t("notAuthenticated") };
  }

  const { error } = await supabase
    .from("client_consents")
    .update({
      granted,
      granted_at: granted ? new Date().toISOString() : null,
      granted_by_profile_id: userData.user.id,
      notes: notes ?? null,
    })
    .eq("talent_id", talentId)
    .eq("consent_key", consentKey);

  if (error) {
    return { error: error.message };
  }

  return {};
}

export function hasConsent(consents: ClientConsent[], key: ConsentKey): boolean {
  return consents.some((c) => c.consentKey === key && c.granted);
}

function mapConsent(row: Record<string, unknown>): ClientConsent {
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    consentKey: String(row.consent_key),
    granted: Boolean(row.granted),
    grantedAt: row.granted_at ? String(row.granted_at) : null,
    grantedByProfileId: row.granted_by_profile_id ? String(row.granted_by_profile_id) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
