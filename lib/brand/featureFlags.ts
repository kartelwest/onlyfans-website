import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface BrandGrowthFlags {
  brandGrowthEnabled: boolean;
  featureXEnabled: boolean;
  ampliaTitle: string;
  ampliaInternalName: string;
}

const DEFAULT_FLAGS: BrandGrowthFlags = {
  brandGrowthEnabled: true,
  featureXEnabled: false,
  ampliaTitle: "Amplia",
  ampliaInternalName: "Brand Growth",
};

export async function getBrandGrowthFlags(): Promise<BrandGrowthFlags> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "brand_growth_enabled",
      "feature_x_enabled",
      "amplia_title",
      "amplia_internal_name",
    ]);

  const map = new Map<string, unknown>();
  for (const row of rows ?? []) {
    map.set(row.key, row.value);
  }

  return {
    brandGrowthEnabled: asBoolean(map.get("brand_growth_enabled"), DEFAULT_FLAGS.brandGrowthEnabled),
    featureXEnabled: asBoolean(map.get("feature_x_enabled"), DEFAULT_FLAGS.featureXEnabled),
    ampliaTitle: asString(map.get("amplia_title"), DEFAULT_FLAGS.ampliaTitle),
    ampliaInternalName: asString(map.get("amplia_internal_name"), DEFAULT_FLAGS.ampliaInternalName),
  };
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}
