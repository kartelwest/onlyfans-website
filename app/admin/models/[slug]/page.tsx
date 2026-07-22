import { notFound, redirect } from "next/navigation";

import ModelAdminClient from "./ModelAdminClient";

import { createClient } from "@/lib/supabase/server";

import type {
  ChecklistStatus,
  ManagementRole,
  Model,
  ModelChecklist,
} from "@/types/model";

export const dynamic = "force-dynamic";

type ModelPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const allowedChecklistStatuses: ChecklistStatus[] = [
  "not_started",
  "planned",
  "in_progress",
  "completed",
  "missing",
  "inactive",
  "duplicate",
  "blocked",
];

function normalizeChecklistStatus(
  value: string | null | undefined,
): ChecklistStatus {
  if (
    value &&
    allowedChecklistStatuses.includes(
      value as ChecklistStatus,
    )
  ) {
    return value as ChecklistStatus;
  }

  return "not_started";
}

export default async function ModelAdminPage({
  params,
}: ModelPageProps) {
  const { slug } = await params;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const {
    data: currentProfile,
    error: currentProfileError,
  } = await supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        role,
        active
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (
    currentProfileError ||
    !currentProfile ||
    !currentProfile.active
  ) {
    redirect("/login");
  }

  const currentUserRole =
    currentProfile.role as ManagementRole;

  if (
    currentUserRole !== "owner" &&
    currentUserRole !== "administrator"
  ) {
    if (currentUserRole === "representative") {
      redirect("/representative");
    }

    if (currentUserRole === "model") {
      redirect("/area-da-modelo");
    }

    redirect("/login");
  }

  const { data: modelRow, error: modelError } =
    await supabase
    .from("models")
    .select(
      `
        id,
        profile_id,
        model_number,
        slug,
        display_name,
        stage_name,
        birthday,
        nationality,
        city,
        language,
        email,
        whatsapp,
        representative_id,
        onboarding_percentage,
        instagram,
        twitter,
        reddit,
        tiktok,
        youtube,
        facebook,
        onlyfans,
        fansly,
        drive_onlyfans,
        drive_instagram,
        drive_twitter,
        status,
        onboarding_complete,
        active,
        profile_photo_url,
        latest_note_summary,
        last_login_at,
        created_at,
        updated_at
      `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (modelError) {
    console.error(
      "Erro ao carregar a modelo:",
      modelError,
    );

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080a] px-4 text-white">
        <section className="w-full max-w-xl rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
            Erro
          </p>

          <h1 className="mt-3 text-2xl font-bold">
            Não foi possível carregar a modelo
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-100/75">
            {modelError.message}
          </p>
        </section>
      </main>
    );
  }

  if (!modelRow) {
    notFound();
  }

  const {
    data: modelProfile,
    error: modelProfileError,
  } = await supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        role,
        active
      `,
    )
    .eq("id", modelRow.profile_id)
    .maybeSingle();

  if (modelProfileError) {
    console.error(
      "Erro ao carregar o perfil da modelo:",
      modelProfileError,
    );
  }

  const model: Model = {
    id: modelRow.id,

    profileId: modelRow.profile_id,

    modelNumber:
      modelRow.model_number ?? null,

    slug: modelRow.slug,

    displayName:
      modelRow.display_name,

    fullName:
      modelProfile?.full_name ??
      modelRow.display_name,

    stageName:
      modelRow.stage_name ?? null,

    birthday:
      modelRow.birthday ?? null,

    nationality:
      modelRow.nationality ?? null,

    city:
      modelRow.city ?? null,

    language:
      modelRow.language ?? null,

    email:
      modelRow.email ?? null,

    whatsapp:
      modelRow.whatsapp ?? null,

    representativeId:
      modelRow.representative_id ?? null,

    onboardingPercentage:
      modelRow.onboarding_percentage ?? 0,

    instagram:
      modelRow.instagram ?? null,

    twitter:
      modelRow.twitter ?? null,

    reddit:
      modelRow.reddit ?? null,

    tiktok:
      modelRow.tiktok ?? null,

    youtube:
      modelRow.youtube ?? null,

    facebook:
      modelRow.facebook ?? null,

    onlyfans:
      modelRow.onlyfans ?? null,

    fansly:
      modelRow.fansly ?? null,

    driveOnlyfans:
      modelRow.drive_onlyfans ?? null,

    driveInstagram:
      modelRow.drive_instagram ?? null,

    driveTwitter:
      modelRow.drive_twitter ?? null,

    status:
      modelRow.status ?? null,

    onboardingComplete:
      modelRow.onboarding_complete ?? false,

    active:
      modelRow.active ?? false,

    profilePhotoUrl:
      modelRow.profile_photo_url ?? null,

    latestNoteSummary:
      modelRow.latest_note_summary ?? null,

    lastLoginAt:
      modelRow.last_login_at ?? null,

    createdAt:
      modelRow.created_at,

    updatedAt:
      modelRow.updated_at,
  };

  const {
    data: checklistRow,
    error: checklistError,
  } = await supabase
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
        content_received_status,
        onboarding_percentage,
        created_at,
        updated_at
      `,
    )
    .eq("model_id", model.id)
    .maybeSingle();

  if (checklistError) {
    console.error(
      "Erro ao carregar o checklist:",
      checklistError,
    );
  }

  const checklist: ModelChecklist = {
    modelId: model.id,

    onlyfansStatus:
      normalizeChecklistStatus(
        checklistRow?.onlyfans_status,
      ),

    fanslyStatus:
      normalizeChecklistStatus(
        checklistRow?.fansly_status,
      ),

    instagramStatus:
      normalizeChecklistStatus(
        checklistRow?.instagram_status,
      ),

    twitterStatus:
      normalizeChecklistStatus(
        checklistRow?.twitter_status,
      ),

    redditStatus:
      normalizeChecklistStatus(
        checklistRow?.reddit_status,
      ),

    tiktokStatus:
      normalizeChecklistStatus(
        checklistRow?.tiktok_status,
      ),

    youtubeStatus:
      normalizeChecklistStatus(
        checklistRow?.youtube_status,
      ),

    facebookStatus:
      normalizeChecklistStatus(
        checklistRow?.facebook_status,
      ),

    googleDriveStatus:
      normalizeChecklistStatus(
        checklistRow?.google_drive_status,
      ),

    websiteLoginStatus:
      normalizeChecklistStatus(
        checklistRow?.website_login_status,
      ),

    contractStatus:
      normalizeChecklistStatus(
        checklistRow?.contract_status,
      ),

    modelReleaseStatus:
      normalizeChecklistStatus(
        checklistRow?.model_release_status,
      ),

    identityDocumentStatus:
      normalizeChecklistStatus(
        checklistRow?.identity_document_status,
      ),

    cpfStatus:
      normalizeChecklistStatus(
        checklistRow?.cpf_status,
      ),

    pixStatus:
      normalizeChecklistStatus(
        checklistRow?.pix_status,
      ),

    bankAccountStatus:
      normalizeChecklistStatus(
        checklistRow?.bank_account_status,
      ),

    onlyfansVerificationStatus:
      normalizeChecklistStatus(
        checklistRow
          ?.onlyfans_verification_status,
      ),

    fanslyVerificationStatus:
      normalizeChecklistStatus(
        checklistRow
          ?.fansly_verification_status,
      ),

    welcomeCallStatus:
      normalizeChecklistStatus(
        checklistRow?.welcome_call_status,
      ),

    contentReceivedStatus:
      normalizeChecklistStatus(
        checklistRow?.content_received_status,
      ),

    onboardingPercentage:
      checklistRow?.onboarding_percentage ??
      model.onboardingPercentage ??
      0,

    createdAt:
      checklistRow?.created_at ??
      model.createdAt,

    updatedAt:
      checklistRow?.updated_at ??
      model.updatedAt,
  };


  return (
    <ModelAdminClient
      model={model}
      checklist={checklist}
      currentUserRole={currentUserRole}
    />
  );
}