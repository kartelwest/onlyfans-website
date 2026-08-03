import { notFound, redirect } from "next/navigation";

import ViewAsBanner from "@/components/admin/ViewAsBanner";
import RepresentativeDashboardView, {
  type RepresentativeDashboardModel,
} from "@/components/representative/RepresentativeDashboardView";
import { logStaffAudit } from "@/lib/audit/staffAudit";
import { sortByModelStatus } from "@/lib/models/modelStatusOrder";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * The representative's screen, as an admin.
 *
 * It renders the component /representative renders, from the same query, so
 * what is on display is the rep's real back office — onboarding buttons and
 * all — rather than a replica that drifts. The admin keeps their own session
 * throughout: nothing here is signed in as the rep, and every read still runs
 * under the admin's own RLS.
 */
export default async function ViewAsRepresentativePage({
  params,
}: {
  params: Promise<{ repId: string }>;
}) {
  const { repId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
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

  const { data: representative, error: representativeError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", repId)
    .eq("role", "representative")
    .maybeSingle();

  if (representativeError || !representative) {
    notFound();
  }

  const { data: models, error } = await supabase
    .from("models")
    .select(
      `
        id,
        display_name,
        stage_name,
        instagram,
        whatsapp,
        onboarding_percentage,
        status,
        active,
        last_login_at
      `,
    )
    .eq("representative_id", repId)
    .order("display_name", { ascending: true });

  const label = `Vendo como o representante ${representative.full_name ?? ""} veria`;

  if (error) {
    return (
      <>
        <ViewAsBanner label={label} backHref="/admin/representatives" />

        <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-4xl font-bold text-[#4b2438]">
              Área do Representante
            </h1>

            <p className="mt-3 text-red-600">Erro ao carregar modelos.</p>
          </div>
        </main>
      </>
    );
  }

  const assignedModels = sortByModelStatus(
    (models ?? []) as RepresentativeDashboardModel[],
    (model) => ({
      status: model.status,
      active: model.active,
      name: model.display_name,
    }),
  );

  // Who looked at whose back office, and when. Best-effort: a log that cannot
  // be written must not take the screen down with it.
  await logStaffAudit(createAdminClient(), {
    action: "view_as_representative",
    actor: {
      id: viewerProfile.id as string,
      fullName: viewerProfile.full_name as string | null,
      role: viewerRole,
    },
    targetType: "representative",
    targetId: representative.id as string,
    targetName: representative.full_name as string | null,
    newValue: `${assignedModels.length} modelo(s) visíveis`,
    context: { viewAs: true },
  });

  return (
    <>
      <ViewAsBanner label={label} backHref="/admin/representatives" />

      <RepresentativeDashboardView
        representativeName={representative.full_name ?? ""}
        models={assignedModels}
        hrefs={{
          model: (model) => `/admin/view-as/model/${model.id}/representative`,
          onboarding: (model) =>
            `/admin/view-as/model/${model.id}/representative/onboarding`,
        }}
      />
    </>
  );
}
