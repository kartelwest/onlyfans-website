import { notFound, redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ModelDashboardView from "@/components/model-dashboard/ModelDashboardView";
import NotesTab from "@/components/admin/model/NotesTab";
import { isStaffRole } from "@/lib/auth/roles";
import {
  loadModelDashboard,
  DASHBOARD_MODEL_COLUMNS,
} from "@/lib/models/modelDashboardData";
import type { ManagementRole } from "@/types/model";

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

  if (!profile || !profile.active) {
    redirect("/login");
  }

  // Staff outrank a representative: the same screen is theirs to see, through
  // the admin preview of it, rather than a bounce to the login page.
  if (isStaffRole(profile.role as ManagementRole)) {
    redirect(`/admin/view-as/model/${id}/representative`);
  }

  if (
    profile.role !== "representative" ||
    profile.status !== "ativa"
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

  const { model, checklist, earnings, ledger } = await loadModelDashboard({
    supabase,
    admin: createAdminClient(),
    modelRow,
  });

  return (
    <ModelDashboardView
      viewerRole="representative"
      model={model}
      checklist={checklist}
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
