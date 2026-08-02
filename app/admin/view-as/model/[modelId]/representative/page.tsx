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
 * The representative view: this model as her rep sees her, which is the same
 * dashboard with the model's own controls taken away.
 *
 * Keyed by the model, not by the rep: an admin opens it from the model's row,
 * and a model with nobody assigned yet still has a rep view to preview — that
 * is the whole point of checking before assigning one.
 */
export default async function ViewAsRepresentativeModelPage({
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

  const { data: modelRow, error: modelError } = await supabase
    .from("models")
    .select(DASHBOARD_MODEL_COLUMNS)
    .eq("id", modelId)
    .maybeSingle();

  if (modelError || !modelRow) {
    notFound();
  }

  const { data: representative } = modelRow.representative_id
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", modelRow.representative_id)
        .maybeSingle()
    : { data: null };

  const representativeName =
    (representative?.full_name as string | null)?.trim() || null;

  const { model, checklist, earnings, ledger } = await loadModelDashboard({
    supabase,
    admin: createAdminClient(),
    modelRow,
  });

  return (
    <>
      <ViewAsBanner
        label={
          representativeName
            ? `Vendo ${model.stageName} como o representante ${representativeName} veria`
            : `Vendo ${model.stageName} como um representante veria (nenhum atribuído)`
        }
        backHref="/admin/models"
      />

      <ModelDashboardView
        viewerRole="representative"
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
