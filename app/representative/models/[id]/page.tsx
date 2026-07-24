import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ModelDashboardView from "@/components/model-dashboard/ModelDashboardView";
import {
  buildDashboardChecklist,
  buildDashboardEarnings,
  buildDashboardModel,
  DASHBOARD_MODEL_COLUMNS,
} from "@/lib/models/modelDashboardData";

export const dynamic = "force-dynamic";

export default async function RepresentativeModelDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active || profile.role !== "representative") {
    redirect("/login");
  }

  // representative_id is enforced both here and by RLS (models_select policy
  // requires is_management() OR is_own_model() OR is_assigned_representative())
  // — an unassigned model simply won't come back, staff or otherwise.
  const { data: modelRow, error: modelError } = await supabase
    .from("models")
    .select(DASHBOARD_MODEL_COLUMNS)
    .eq("id", id)
    .eq("representative_id", user.id)
    .maybeSingle();

  if (modelError || !modelRow) {
    notFound();
  }

  const [{ data: checklistRow }, { data: paymentsRow }, { data: earningsRows }] =
    await Promise.all([
      supabase
        .from("model_checklist")
        .select(
          "onlyfans_status, instagram_status, twitter_status, proxy_browser_status, contract_status, content_received_status",
        )
        .eq("model_id", id)
        .maybeSingle(),
      supabase
        .from("model_payments")
        .select("model_percentage, agency_percentage, marketing_percentage")
        .eq("model_id", id)
        .maybeSingle(),
      supabase
        .from("model_earnings_reports")
        .select("gross_revenue, model_share, agency_share, marketing_share, report_date, created_at, updated_at")
        .eq("model_id", id),
    ]);

  const dashboardModel = buildDashboardModel(modelRow);
  const dashboardChecklist = buildDashboardChecklist(modelRow, checklistRow);
  const dashboardEarnings = buildDashboardEarnings(paymentsRow, earningsRows ?? []);

  return (
    <ModelDashboardView
      viewerRole="representative"
      model={dashboardModel}
      checklist={dashboardChecklist}
      earnings={dashboardEarnings}
      canEditAvatar={false}
    />
  );
}
