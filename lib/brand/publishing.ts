import "server-only";

import { createClient } from "@/lib/supabase/server";
import { publishToInstagram } from "@/lib/brand/social/instagram";
import { publishToX } from "@/lib/brand/social/x";
import { decryptToken } from "@/lib/brand/tokenCrypto";
import type { ContentItem, Platform } from "@/types/brand";

export interface ScheduleContentInput {
  contentItemId: string;
  socialAccountId: string;
  scheduledFor?: string;
}

export async function scheduleContent(
  input: ScheduleContentInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Não autenticado." };
  }

  const { error } = await supabase
    .from("content_items")
    .update({
      status: "scheduled",
      scheduled_for: input.scheduledFor ?? null,
      social_account_id: input.socialAccountId,
    })
    .eq("id", input.contentItemId);

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function publishContentItem(contentItemId: string): Promise<{
  success: boolean;
  publishId?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("content_items")
    .select("*, social_accounts(platform)")
    .eq("id", contentItemId)
    .single();

  if (error || !item) {
    return { success: false, error: error?.message ?? "Item não encontrado." };
  }

  const socialAccount = item.social_accounts as { platform: Platform } | null;
  if (!socialAccount) {
    return { success: false, error: "Conta social não vinculada." };
  }

  const { data: tokenRow } = await supabase
    .from("social_account_tokens")
    .select("encrypted_access_token")
    .eq("social_account_id", item.social_account_id)
    .single();

  if (!tokenRow?.encrypted_access_token) {
    return { success: false, error: "Token de acesso não encontrado ou não criptografado." };
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(String(tokenRow.encrypted_access_token));
  } catch {
    return { success: false, error: "Falha ao descriptografar o token." };
  }

  const contentItem = mapContentItem(item);

  switch (socialAccount.platform) {
    case "instagram": {
      const result = await publishToInstagram({
        accessToken,
        instagramAccountId: "", // resolved from connection metadata in a full implementation
        mediaType: mapInstagramMediaType(contentItem.contentType),
        mediaUrls: [], // resolved from content assets
        caption: contentItem.caption ?? "",
      });
      return {
        success: result.success,
        publishId: result.publishId,
        error: result.error,
      };
    }
    case "x": {
      const result = await publishToX({ contentItem, accessToken });
      return {
        success: result.success,
        publishId: result.publishId,
        error: result.error,
      };
    }
    default:
      return { success: false, error: `Publicação automática para ${socialAccount.platform} ainda não suportada.` };
  }
}

function mapInstagramMediaType(contentType: ContentItem["contentType"]): "image" | "video" | "carousel" | "reel" | "story" {
  switch (contentType) {
    case "feed_carousel":
      return "carousel";
    case "reel":
      return "reel";
    case "story":
    case "story_series":
      return "story";
    case "feed_image":
    default:
      return "image";
  }
}

function mapContentItem(row: Record<string, unknown>): ContentItem {
  return {
    id: String(row.id),
    talentId: String(row.talent_id),
    brandProfileId: row.brand_profile_id ? String(row.brand_profile_id) : null,
    socialAccountId: row.social_account_id ? String(row.social_account_id) : null,
    platform: String(row.platform) as Platform,
    contentType: String(row.content_type) as ContentItem["contentType"],
    title: row.title ? String(row.title) : null,
    body: row.body ? String(row.body) : null,
    caption: row.caption ? String(row.caption) : null,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags.map(String) : [],
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
    altText: row.alt_text ? String(row.alt_text) : null,
    cta: row.cta ? String(row.cta) : null,
    mediaAssetIds: Array.isArray(row.media_asset_ids) ? row.media_asset_ids.map(String) : [],
    source: String(row.source) as ContentItem["source"],
    status: String(row.status) as ContentItem["status"],
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    publishedUrl: row.published_url ? String(row.published_url) : null,
    externalId: row.external_id ? String(row.external_id) : null,
    riskStatus: row.risk_status ? String(row.risk_status) : null,
    aiGenerationId: row.ai_generation_id ? String(row.ai_generation_id) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
