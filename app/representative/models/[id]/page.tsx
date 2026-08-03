import { notFound, redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ModelDashboardView from "@/components/model-dashboard/ModelDashboardView";
import NotesTab from "@/components/admin/model/NotesTab";
import {
  buildDashboardChecklist,
  buildDashboardModel,
  loadDashboardFinance,
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
    .select("role, active, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    !profile.active ||
    profile.status !== "ativa" ||
    profile.role !== "representative"
  ) {
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

  const [{ data: checklistRow }, { data: paymentsRow }] = await Promise.all([
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
  ]);

  const dashboardModel = buildDashboardModel(modelRow);
  const dashboardChecklist = buildDashboardChecklist(modelRow, checklistRow);

  const { earnings, ledger } = await loadDashboardFinance({
    supabase,
    admin: createAdminClient(),
    model: dashboardModel,
    paymentsRow,
    expensesEnabled: modelRow.expenses_enabled === true,
  });

  return (
    <ModelDashboardView
      viewerRole="representative"
      model={dashboardModel}
      checklist={dashboardChecklist}
      earnings={earnings}
      ledger={ledger}
      canEditAvatar={false}
    >
      <div className="mt-6">
        <NotesTab
          modelId={id}
          currentUserRole="representative"
        />
      </div>
    </ModelDashboardView>
  );
}
