import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ModelDashboardView from "@/components/model-dashboard/ModelDashboardView";
import {
  loadModelDashboard,
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
    const t = await getTranslations("dashboard.model");

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0a0d] px-4 text-white">
        <section className="w-full max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
            {t("profileNotFound")}
          </p>
          <p className="mt-3 text-sm leading-6 text-red-100/75">
            {t("contactAgency")}
          </p>
        </section>
      </main>
    );
  }

  const { model, checklist, earnings, ledger } = await loadModelDashboard({
    supabase,
    admin: createAdminClient(),
    modelRow,
  });

  return (
    <ModelDashboardView
      viewerRole="model"
      model={model}
      checklist={checklist}
      earnings={earnings}
      ledger={ledger}
      canEditAvatar
    />
  );
}
