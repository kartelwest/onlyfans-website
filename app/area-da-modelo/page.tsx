import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ModelDashboardView from "@/components/model-dashboard/ModelDashboardView";
import {
  buildDashboardChecklist,
  buildDashboardModel,
  loadDashboardFinance,
  DASHBOARD_MODEL_COLUMNS,
} from "@/lib/models/modelDashboardData";

export const dynamic = "force-dynamic";

export default async function AreaDaModeloPage() {
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

  if (!profile || !profile.active || profile.role !== "model") {
    redirect("/login");
  }

  // profile_id is enforced both here and by RLS (models_select policy
  // requires is_management() OR is_own_model() OR is_assigned_representative()).
  const { data: modelRow, error: modelError } = await supabase
    .from("models")
    .select(DASHBOARD_MODEL_COLUMNS)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (modelError || !modelRow) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0a0d] px-4 text-white">
        <section className="w-full max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
            Perfil não encontrado
          </p>
          <p className="mt-3 text-sm leading-6 text-red-100/75">
            Entre em contato com a agência.
          </p>
        </section>
      </main>
    );
  }

  const [{ data: checklistRow }, { data: paymentsRow }] = await Promise.all([
    supabase
      .from("model_checklist")
      .select(
        "onlyfans_status, instagram_status, twitter_status, proxy_browser_status, contract_status, content_received_status",
      )
      .eq("model_id", modelRow.id)
      .maybeSingle(),
    supabase
      .from("model_payments")
      .select("model_percentage, agency_percentage, marketing_percentage")
      .eq("model_id", modelRow.id)
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
      viewerRole="model"
      model={dashboardModel}
      checklist={dashboardChecklist}
      earnings={earnings}
      ledger={ledger}
      canEditAvatar
    />
  );
}
