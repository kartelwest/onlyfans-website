import { notFound, redirect } from "next/navigation";

import ViewAsBanner from "@/components/admin/ViewAsBanner";
import ModelDashboardView from "@/components/model-dashboard/ModelDashboardView";
import {
  loadModelDashboard,
  DASHBOARD_MODEL_COLUMNS,
} from "@/lib/models/modelDashboardData";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * The model view: her own dashboard, exactly as she sees it.
 *
 * It renders the very component /area-da-modelo renders, from the very same
 * loader — a hand-written replica drifts the moment the real screen changes,
 * and a preview that lies is worse than no preview. Only the acting parts are
 * off (previewMode), because the viewer is an admin, not the model.
 */
export default async function ViewAsModelPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  const viewerRole = viewerProfile?.role as ManagementRole | undefined;

  if (
    !viewerProfile ||
    !viewerProfile.active ||
    (viewerRole !== "owner" && viewerRole !== "administrator")
  ) {
    redirect("/admin/models");
  }

  // slug rides along only to point the banner at the admin side of the same
  // model — the dashboard itself never uses it.
  const { data: modelRow, error: modelError } = await supabase
    .from("models")
    .select(`${DASHBOARD_MODEL_COLUMNS}, slug`)
    .eq("id", modelId)
    .maybeSingle();

  if (modelError || !modelRow) {
    notFound();
  }

  const { model, checklist, earnings, ledger } = await loadModelDashboard({
    supabase,
    admin: createAdminClient(),
    modelRow,
  });

  return (
    <>
      <ViewAsBanner
        label={`Vendo como a modelo ${model.stageName} veria`}
        backHref="/admin/pageview"
        switcher={{
          modelId: model.id,
          modelSlug: (modelRow.slug as string | null) ?? null,
          current: "model",
        }}
      />

      <ModelDashboardView
        viewerRole="model"
        model={model}
        checklist={checklist}
        earnings={earnings}
        ledger={ledger}
        canEditAvatar={false}
        previewMode
      />
    </>
  );
}
