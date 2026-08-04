import "server-only";

import type { BrandAccountStatus } from "@/types/brand";

export interface InstagramOAuthUrlInput {
  redirectUri: string;
  state: string;
  scope?: string[];
}

export interface InstagramPublishInput {
  accessToken: string;
  instagramAccountId: string;
  mediaType: "image" | "video" | "carousel" | "reel" | "story";
  mediaUrls: string[];
  caption: string;
}

export interface InstagramPublishResult {
  success: boolean;
  containerId?: string;
  publishId?: string;
  error?: string;
}

const REQUIRED_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
];

export function getInstagramOAuthUrl(input: InstagramOAuthUrlInput): string {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    throw new Error("META_APP_ID is not configured.");
  }

  const scope = (input.scope ?? REQUIRED_OAUTH_SCOPES).join(",");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: input.redirectUri,
    scope,
    response_type: "code",
    state: input.state,
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return { error: "Meta app credentials are not configured." };
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`);
  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok || data.error) {
    return { error: String(data.error ?? data.message ?? "OAuth token exchange failed.") };
  }

  return {
    accessToken: String(data.access_token ?? ""),
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
  };
}

export async function publishToInstagram(
  input: InstagramPublishInput,
): Promise<InstagramPublishResult> {
  void input;
  // Fail safely if Instagram publishing is invoked without proper setup.
  // Real implementation requires Meta Business Verification + App Review.
  return {
    success: false,
    error:
      "Instagram live publishing requires a Meta Developer App with Business Verification and App Review for instagram_content_publish. This is stubbed until those steps are completed.",
  };
}

export function nextAccountStatusAfterVerification(
  current: BrandAccountStatus,
): BrandAccountStatus {
  switch (current) {
    case "awaiting_connection":
      return "connected";
    case "connected":
      return "active";
    default:
      return current;
  }
}

/** A key under `errors.instagram`, or null when the account is fine. */
export function accountStatusWarningKey(
  status: BrandAccountStatus,
): string | null {
  switch (status) {
    case "authorization_expired":
      return "authorizationExpired";
    case "restricted":
      return "restricted";
    case "suspended":
      return "suspended";
    default:
      return null;
  }
}
