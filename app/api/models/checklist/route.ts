import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type {
  ChecklistStatus,
  ManagementRole,
} from "@/types/model";

const allowedStatuses: ChecklistStatus[] = [
  "not_started",
  "planned",
  "in_progress",
  "completed",
  "missing",
  "inactive",
  "duplicate",
  "blocked",
];

const checklistFieldMap = {
  onlyfansStatus: "onlyfans_status",
  fanslyStatus: "fansly_status",
  instagramStatus: "instagram_status",
  twitterStatus: "twitter_status",
  redditStatus: "reddit_status",
  tiktokStatus: "tiktok_status",
  youtubeStatus: "youtube_status",
  facebookStatus: "facebook_status",
  googleDriveStatus: "google_drive_status",
  websiteLoginStatus: "website_login_status",
  contractStatus: "contract_status",
  modelReleaseStatus: "model_release_status",
  identityDocumentStatus: "identity_document_status",
  cpfStatus: "cpf_status",
  pixStatus: "pix_status",
  bankAccountStatus: "bank_account_status",
  onlyfansVerificationStatus:
    "onlyfans_verification_status",
  fanslyVerificationStatus:
    "fansly_verification_status",
  welcomeCallStatus: "welcome_call_status",
  contentReceivedStatus: "content_received_status",
} as const;

type ChecklistField = keyof typeof checklistFieldMap;

type ChecklistUpdateBody = {
  modelId?: string;
  field?: ChecklistField;
  status?: ChecklistStatus;
};

const databaseChecklistFields = Object.values(
  checklistFieldMap,
);

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Usuário não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.active
    ) {
      return NextResponse.json(
        {
          error: "Perfil inválido ou inativo.",
        },
        {
          status: 403,
        },
      );
    }

    const currentUserRole =
      profile.role as ManagementRole;

    if (
      currentUserRole !== "owner" &&
      currentUserRole !== "administrator"
    ) {
      return NextResponse.json(
        {
          error:
            "Você não tem permissão para alterar este checklist.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      (await request.json()) as ChecklistUpdateBody;

    const { modelId, field, status } = body;

    if (!modelId || typeof modelId !== "string") {
      return NextResponse.json(
        {
          error: "O ID da modelo é obrigatório.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !field ||
      !Object.prototype.hasOwnProperty.call(
        checklistFieldMap,
        field,
      )
    ) {
      return NextResponse.json(
        {
          error: "Campo de checklist inválido.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !status ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        {
          error: "Status inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const adminSupabase = createAdminClient();

    const {
      data: existingChecklist,
      error: existingChecklistError,
    } = await adminSupabase
      .from("model_checklist")
      .select(
        `
          model_id,
          onlyfans_status,
          fansly_status,
          instagram_status,
          twitter_status,
          reddit_status,
          tiktok_status,
          youtube_status,
          facebook_status,
          google_drive_status,
          website_login_status,
          contract_status,
          model_release_status,
          identity_document_status,
          cpf_status,
          pix_status,
          bank_account_status,
          onlyfans_verification_status,
          fansly_verification_status,
          welcome_call_status,
          content_received_status
        `,
      )
      .eq("model_id", modelId)
      .maybeSingle();

    if (existingChecklistError) {
      console.error(
        "Erro ao carregar checklist:",
        existingChecklistError,
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar o checklist.",
        },
        {
          status: 500,
        },
      );
    }

    const databaseField =
      checklistFieldMap[field];

    const updatedStatuses: Record<
      string,
      ChecklistStatus
    > = {};

    for (const checklistField of databaseChecklistFields) {
      const existingValue =
        existingChecklist?.[checklistField];

      updatedStatuses[checklistField] =
        allowedStatuses.includes(
          existingValue as ChecklistStatus,
        )
          ? (existingValue as ChecklistStatus)
          : "not_started";
    }

    updatedStatuses[databaseField] = status;

    const completedItems =
      databaseChecklistFields.filter(
        (checklistField) =>
          updatedStatuses[checklistField] ===
          "completed",
      ).length;

    const onboardingPercentage = Math.round(
      (completedItems /
        databaseChecklistFields.length) *
        100,
    );

    const now = new Date().toISOString();

    const {
      error: checklistUpdateError,
    } = await adminSupabase
      .from("model_checklist")
      .upsert(
        {
          model_id: modelId,
          ...updatedStatuses,
          onboarding_percentage:
            onboardingPercentage,
          updated_at: now,
        },
        {
          onConflict: "model_id",
        },
      );

    if (checklistUpdateError) {
      console.error(
        "Erro ao atualizar checklist:",
        checklistUpdateError,
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível salvar o novo status.",
        },
        {
          status: 500,
        },
      );
    }

    const {
      error: modelUpdateError,
    } = await adminSupabase
      .from("models")
      .update({
        onboarding_percentage:
          onboardingPercentage,
        onboarding_complete:
          onboardingPercentage === 100,
        updated_at: now,
      })
      .eq("id", modelId);

    if (modelUpdateError) {
      console.error(
        "Erro ao atualizar progresso da modelo:",
        modelUpdateError,
      );

      return NextResponse.json(
        {
          error:
            "O checklist foi salvo, mas o progresso geral não foi atualizado.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      field,
      status,
      completedItems,
      totalItems:
        databaseChecklistFields.length,
      onboardingPercentage,
    });
  } catch (error) {
    console.error(
      "Erro inesperado na API do checklist:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro inesperado ao salvar o checklist.",
      },
      {
        status: 500,
      },
    );
  }
}