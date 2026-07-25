import "server-only";

import { getBrandGrowthFlags } from "@/lib/brand/featureFlags";
import type { BrandAccountStatus, ContentItem } from "@/types/brand";

export interface XPublishInput {
  contentItem: ContentItem;
  accessToken: string;
}

export interface XPublishResult {
  success: boolean;
  publishId?: string;
  error?: string;
}

export async function canUseXApi(): Promise<boolean> {
  const flags = await getBrandGrowthFlags();
  return flags.featureXEnabled;
}

export async function publishToX(input: XPublishInput): Promise<XPublishResult> {
  void input;
  if (!(await canUseXApi())) {
    return {
      success: false,
      error:
        "X API live publishing is disabled. Enable FEATURE_X_ENABLED and configure X API credentials to use live publishing. Manual playbook copy-paste remains available.",
    };
  }

  // Real X API is pay-per-use and not implemented in this build.
  return {
    success: false,
    error: "X API live publishing is not implemented. Use the Manual X Playbook.",
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
