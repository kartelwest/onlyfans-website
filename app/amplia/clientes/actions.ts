"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ClientActionState = {
  success: boolean;
  message: string;
};

const initialFail = (message: string): ClientActionState => ({
  success: false,
  message,
});

async function requireManagementUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "Sua sessão expirou. Entre novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !profile.active ||
    (profile.role !== "owner" && profile.role !== "administrator")
  ) {
    return {
      supabase,
      user: null,
      error: "Você não tem permissão para gerenciar clientes do Amplia.",
    };
  }

  return { supabase, user, error: null };
}

async function enrollServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  talentId: string,
  userId: string,
  options: {
    onlyfans?: boolean;
    fansly?: boolean;
    instagram?: boolean;
    x?: boolean;
  },
) {
  const { data: serviceTypes } = await supabase
    .from("service_types")
    .select("id, key");

  const byKey = new Map((serviceTypes ?? []).map((row) => [row.key, row.id]));

  const rows: {
    talent_id: string;
    service_type_id: string;
    status: string;
    enrolled_at: string;
    enrolled_by: string;
  }[] = [];

  const wanted: [keyof typeof options, string][] = [
    ["onlyfans", "onlyfans"],
    ["fansly", "fansly"],
    ["instagram", "brand_growth_instagram"],
    ["x", "brand_growth_x"],
  ];

  for (const [flag, key] of wanted) {
    if (!options[flag]) continue;
    const serviceTypeId = byKey.get(key);
    if (!serviceTypeId) continue;

    rows.push({
      talent_id: talentId,
      service_type_id: serviceTypeId,
      status: key.startsWith("brand_growth") ? "planning" : "active",
      enrolled_at: new Date().toISOString(),
      enrolled_by: userId,
    });
  }

  if (rows.length > 0) {
    await supabase.from("service_enrollments").upsert(rows, {
      onConflict: "talent_id,service_type_id",
    });
  }
}

export async function createBrandGrowthOnlyClientAction(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const stageName = String(formData.get("stageName") ?? "").trim();
  const displayName =
    String(formData.get("displayName") ?? "").trim() || stageName;
  const legalName = String(formData.get("legalName") ?? "").trim();
  const niche1 = String(formData.get("niche1") ?? "").trim();
  const instagram = formData.get("instagram") === "on";
  const x = formData.get("x") === "on";

  if (!stageName) {
    return initialFail("Digite o nome artístico da cliente.");
  }

  if (!niche1) {
    return initialFail("Informe pelo menos o primeiro nicho.");
  }

  if (!instagram && !x) {
    return initialFail("Selecione pelo menos uma plataforma (Instagram ou X).");
  }

  const { supabase, user, error } = await requireManagementUser();
  if (error || !user) return initialFail(error ?? "Não autorizado.");

  const { data: talent, error: talentError } = await supabase
    .from("talents")
    .insert({
      stage_name: stageName,
      display_name: displayName,
      legal_name: legalName || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (talentError || !talent) {
    return initialFail(
      `Não foi possível criar a cliente: ${talentError?.message}`,
    );
  }

  const { error: profileError } = await supabase.from("brand_profiles").insert({
    talent_id: talent.id,
    niche_1: niche1,
    created_by: user.id,
    updated_by: user.id,
  });

  if (profileError) {
    await supabase.from("talents").delete().eq("id", talent.id);
    return initialFail(
      `Não foi possível criar o perfil de marca: ${profileError.message}`,
    );
  }

  await enrollServices(supabase, talent.id, user.id, { instagram, x });

  revalidatePath("/amplia/clientes");
  revalidatePath("/amplia");

  return { success: true, message: "Cliente Brand Growth criada com sucesso." };
}

export async function enrollExistingModelAction(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const modelId = String(formData.get("modelId") ?? "").trim();
  const niche1 = String(formData.get("niche1") ?? "").trim();
  const instagram = formData.get("instagram") === "on";
  const x = formData.get("x") === "on";

  if (!modelId) {
    return initialFail("Selecione uma modelo.");
  }

  if (!niche1) {
    return initialFail("Informe pelo menos o primeiro nicho.");
  }

  if (!instagram && !x) {
    return initialFail("Selecione pelo menos uma plataforma (Instagram ou X).");
  }

  const { supabase, user, error } = await requireManagementUser();
  if (error || !user) return initialFail(error ?? "Não autorizado.");

  const { data: model, error: modelError } = await supabase
    .from("models")
    .select("id, display_name, stage_name, fansly")
    .eq("id", modelId)
    .single();

  if (modelError || !model) {
    return initialFail("Modelo não encontrada.");
  }

  const { data: talent, error: talentError } = await supabase
    .from("talents")
    .insert({
      linked_model_id: model.id,
      stage_name: model.stage_name || model.display_name,
      display_name: model.display_name,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (talentError || !talent) {
    return initialFail(
      talentError?.code === "23505"
        ? "Esta modelo já está cadastrada no Amplia."
        : `Não foi possível vincular a modelo: ${talentError?.message}`,
    );
  }

  const { error: profileError } = await supabase.from("brand_profiles").insert({
    talent_id: talent.id,
    niche_1: niche1,
    created_by: user.id,
    updated_by: user.id,
  });

  if (profileError) {
    await supabase.from("talents").delete().eq("id", talent.id);
    return initialFail(
      `Não foi possível criar o perfil de marca: ${profileError.message}`,
    );
  }

  await enrollServices(supabase, talent.id, user.id, {
    onlyfans: true,
    fansly: Boolean(model.fansly),
    instagram,
    x,
  });

  revalidatePath("/amplia/clientes");
  revalidatePath("/amplia");

  return {
    success: true,
    message: "Modelo inscrita no Brand Growth com sucesso.",
  };
}
