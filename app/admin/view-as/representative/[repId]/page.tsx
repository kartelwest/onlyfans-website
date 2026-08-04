import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import ViewAsRepresentativeBanner from "@/components/admin/ViewAsRepresentativeBanner";
import RepresentativeDashboardView, {
  type RepresentativeDashboardModel,
} from "@/components/representative/RepresentativeDashboardView";
import { sortByModelStatus } from "@/lib/models/modelStatusOrder";
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
 *
 * Entering and leaving are both recorded — see enterViewAsRepresentative /
 * exitViewAsRepresentative in app/admin/representatives/actions.ts.
 */
export default async function ViewAsRepresentativePage({
  params,
}: {
  params: Promise<{ repId: string }>;
}) {
  const t = await getTranslations("representative.dashboard");
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
    .select("id, full_name, role, active, status")
    .eq("id", repId)
    .eq("role", "representative")
    .maybeSingle();

  if (
    representativeError ||
    !representative ||
    !representative.active ||
    representative.status !== "ativa"
  ) {
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
        <ViewAsRepresentativeBanner
          label={label}
          backHref="/admin/representatives"
          representativeId={representative.id}
        />

        <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-4xl font-bold text-[#4b2438]">
              {t("title")}
            </h1>

            <p className="mt-3 text-red-600">{t("loadFailed")}</p>
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

  return (
    <>
      <ViewAsRepresentativeBanner
        label={label}
        backHref="/admin/representatives"
        representativeId={representative.id}
      />

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
