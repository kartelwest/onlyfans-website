import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import type { ManagementRole } from "@/types/model";

type ProfileRecord = {
  role: ManagementRole;
  active: boolean;
};

type OnboardingItemRecord = {
  id: string;
  model_id: string;
  item_key: string;
  platform: string;
  section_key: string;
  section_title: string;
  section_order: number;
  item_title: string;
  item_description: string | null;
  item_order: number;
  responsibility: "model" | "agency" | "both";
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PatchBody = {
  modelId?: string;
  itemId?: string;
  completed?: boolean;
  notes?: string;
};

async function getAuthenticatedProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          error: "Não autenticado.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (
    profileError ||
    !profile ||
    !profile.active
  ) {
    return {
      error: NextResponse.json(
        {
          error: "Perfil inválido.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  return {
    user,
    profile,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const auth =
      await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const url = new URL(request.url);

    const modelId =
      url.searchParams.get("modelId");

    const platform =
      url.searchParams.get("platform") ??
      "onlyfans";

    if (!modelId) {
      return NextResponse.json(
        {
          error:
            "Identificação da modelo não informada.",
        },
        {
          status: 400,
        },
      );
    }

    // Verify model access based on role
    const supabaseForCheck = await createClient();
    let canAccess = false;

    if (
      auth.profile.role === "owner" ||
      auth.profile.role === "administrator"
    ) {
      // Staff can access all models
      const { data: model } = await supabaseForCheck
        .from("models")
        .select("id")
        .eq("id", modelId)
        .maybeSingle();
      canAccess = !!model;
    } else if (auth.profile.role === "representative") {
      // Rep can only access assigned models
      const { data: model } = await supabaseForCheck
        .from("models")
        .select("id")
        .eq("id", modelId)
        .eq("representative_id", auth.user.id)
        .maybeSingle();
      canAccess = !!model;
    } else if (auth.profile.role === "model") {
      // Model can only access own onboarding
      const { data: model } = await supabaseForCheck
        .from("models")
        .select("id")
        .eq("id", modelId)
        .eq("profile_id", auth.user.id)
        .maybeSingle();
      canAccess = !!model;
    }

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Sem permissão.",
        },
        {
          status: 403,
        },
      );
    }

    // Use request-scoped client for data access (RLS enforced)
    const {
      data: items,
      error: itemsError,
    } = await supabaseForCheck
      .from("model_onboarding_items")
      .select(
        `
          id,
          model_id,
          item_key,
          platform,
          section_key,
          section_title,
          section_order,
          item_title,
          item_description,
          item_order,
          responsibility,
          completed,
          completed_at,
          completed_by,
          notes,
          created_at,
          updated_at
        `,
      )
      .eq("model_id", modelId)
      .eq("platform", platform)
      .order("section_order", {
        ascending: true,
      })
      .order("item_order", {
        ascending: true,
      });

    if (itemsError) {
      console.error(
        "Erro ao carregar onboarding:",
        itemsError,
      );
      return NextResponse.json(
        {
          error:
            "Erro interno ao carregar o onboarding.",
        },
        {
          status: 500,
        },
      );
    }

    const onboardingItems =
      (items ?? []) as OnboardingItemRecord[];

    const total =
      onboardingItems.length;

    const completed =
      onboardingItems.filter(
        (item) => item.completed,
      ).length;

    const remaining =
      Math.max(total - completed, 0);

    const percentage =
      total === 0
        ? 0
        : Math.round(
            (completed / total) * 100,
          );

    return NextResponse.json({
      items: onboardingItems,
      summary: {
        total,
        completed,
        remaining,
        percentage,
      },
      canEdit:
        auth.profile.role === "owner" ||
        auth.profile.role ===
          "administrator",
    });
  } catch (error) {
    console.error(
      "Erro ao carregar onboarding:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao carregar o onboarding.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const auth =
      await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    if (
      auth.profile.role !== "owner" &&
      auth.profile.role !==
        "administrator"
    ) {
      return NextResponse.json(
        {
          error: "Sem permissão.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      (await request.json()) as PatchBody;

    if (
      !body.modelId ||
      !body.itemId
    ) {
      return NextResponse.json(
        {
          error: "Dados inválidos.",
        },
        {
          status: 400,
        },
      );
    }

    const supabaseForUpdate = await createClient();

    const {
      data: existingItem,
      error: existingItemError,
    } = await supabaseForUpdate
      .from("model_onboarding_items")
      .select(
        "id, model_id, completed, notes",
      )
      .eq("id", body.itemId)
      .eq("model_id", body.modelId)
      .maybeSingle();

    if (existingItemError) {
      console.error(
        "Erro ao buscar etapa:",
        existingItemError,
      );
      return NextResponse.json(
        {
          error:
            "Erro interno ao buscar etapa.",
        },
        {
          status: 500,
        },
      );
    }

    if (!existingItem) {
      return NextResponse.json(
        {
          error:
            "Etapa de onboarding não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    const updateValues: {
      completed?: boolean;
      completed_by?: string | null;
      notes?: string;
    } = {};

    if (
      typeof body.completed ===
      "boolean"
    ) {
      updateValues.completed =
        body.completed;

      updateValues.completed_by =
        body.completed
          ? auth.user.id
          : null;
    }

    if (
      typeof body.notes === "string"
    ) {
      updateValues.notes =
        body.notes.trim();
    }

    if (
      Object.keys(updateValues).length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Nenhuma alteração informada.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: updatedItem,
      error: updateError,
    } = await supabaseForUpdate
      .from("model_onboarding_items")
      .update(updateValues)
      .eq("id", body.itemId)
      .eq("model_id", body.modelId)
      .select(
        `
          id,
          model_id,
          item_key,
          platform,
          section_key,
          section_title,
          section_order,
          item_title,
          item_description,
          item_order,
          responsibility,
          completed,
          completed_at,
          completed_by,
          notes,
          created_at,
          updated_at
        `,
      )
      .single<OnboardingItemRecord>();

    if (updateError) {
      console.error(
        "Erro ao atualizar etapa:",
        updateError,
      );
      return NextResponse.json(
        {
          error:
            "Erro interno ao atualizar etapa.",
        },
        {
          status: 500,
        },
      );
    }

    const {
      data: allItems,
      error: summaryError,
    } = await supabaseForUpdate
      .from("model_onboarding_items")
      .select("completed")
      .eq("model_id", body.modelId)
      .eq(
        "platform",
        updatedItem.platform,
      );

    if (summaryError) {
      console.error(
        "Erro ao calcular resumo:",
        summaryError,
      );
      return NextResponse.json(
        {
          error:
            "Erro interno ao calcular resumo.",
        },
        {
          status: 500,
        },
      );
    }

    const total =
      allItems?.length ?? 0;

    const completed =
      allItems?.filter(
        (item) => item.completed,
      ).length ?? 0;

    const remaining =
      Math.max(total - completed, 0);

    const percentage =
      total === 0
        ? 0
        : Math.round(
            (completed / total) * 100,
          );

    return NextResponse.json({
      item: updatedItem,
      summary: {
        total,
        completed,
        remaining,
        percentage,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar onboarding:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao atualizar o onboarding.",
      },
      {
        status: 500,
      },
    );
  }
}