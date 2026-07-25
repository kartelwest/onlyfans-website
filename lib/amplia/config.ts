import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AmpliaConfig = {
  moduleCodeName: string;
  displayName: string;
  featureXEnabled: boolean;
};

const DEFAULTS: AmpliaConfig = {
  moduleCodeName: "Brand Growth",
  displayName: "Amplia",
  featureXEnabled: false,
};

const CONFIG_KEYS = [
  "amplia_module_code_name",
  "amplia_display_name",
  "feature_x_enabled",
] as const;

/**
 * Amplia's internal code name, display name, and the X activation flag are
 * stored in app_settings (config-driven per spec section 2/15) rather than
 * hard-coded, so they can be renamed / flipped without a code change. Falls
 * back to sane defaults if app_settings is unreachable so a settings-table
 * hiccup never hides the whole module.
 */
export async function getAmpliaConfig(
  supabase: SupabaseClient,
): Promise<AmpliaConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", CONFIG_KEYS);

  if (error || !data) {
    return DEFAULTS;
  }

  const values = new Map(data.map((row) => [row.key, row.value]));

  return {
    moduleCodeName:
      (values.get("amplia_module_code_name") as string | undefined) ??
      DEFAULTS.moduleCodeName,
    displayName:
      (values.get("amplia_display_name") as string | undefined) ??
      DEFAULTS.displayName,
    featureXEnabled:
      (values.get("feature_x_enabled") as boolean | undefined) ??
      DEFAULTS.featureXEnabled,
  };
}
