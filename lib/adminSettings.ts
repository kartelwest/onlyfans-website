import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const MODEL_IMPORTER_AUTO_SAVE_KEY = "model_importer_auto_save";

export async function getModelImporterAutoSave(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", MODEL_IMPORTER_AUTO_SAVE_KEY)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.value === true;
}

export async function setModelImporterAutoSave(
  supabase: SupabaseClient,
  autoSave: boolean,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: MODEL_IMPORTER_AUTO_SAVE_KEY, value: autoSave });

  if (error) {
    return { error: error.message };
  }

  return {};
}
