import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getNextModelNumber(
  adminSupabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await adminSupabase
    .from("models")
    .select("model_number")
    .not("model_number", "is", null)
    .order("model_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível gerar o número da modelo: ${error.message}`,
    );
  }

  return (data?.model_number ?? 0) + 1;
}

export async function createUniqueModelSlug(
  adminSupabase: SupabaseClient,
  name: string,
): Promise<string> {
  const baseSlug = createSlug(name) || `modelo-${Date.now()}`;

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await adminSupabase
      .from("models")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Não foi possível verificar o endereço da modelo: ${error.message}`,
      );
    }

    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
