import { redirect } from "next/navigation";

import RepresentativeDashboardView, {
  type RepresentativeDashboardModel,
} from "@/components/representative/RepresentativeDashboardView";
import { isStaffRole } from "@/lib/auth/roles";
import { sortByModelStatus } from "@/lib/models/modelStatusOrder";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

export default async function RepresentativePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active, status")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  // Staff outrank a representative, so they are not turned away here — they are
  // sent to the list that holds every model, with a rep preview per row.
  if (isStaffRole(profile.role as ManagementRole)) {
    redirect("/admin/models");
  }

  // An inactive or archived representative keeps the account and every record
  // attached to it, and loses the back office.
  if (
    profile.role !== "representative" ||
    profile.status !== "ativa"
  ) {
    redirect("/login");
  }

  // Explicit column list, and deliberately without latest_note_summary: that
  // column holds an excerpt of the model's most recent internal note, and
  // notes are readable by owner/administrator only.
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
    .eq("representative_id", user.id)
    .order("display_name", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
            KARAY Models
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
            Área do Representante
          </h1>

          <p className="mt-3 text-red-600">Erro ao carregar modelos.</p>
        </div>
      </main>
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
    <RepresentativeDashboardView
      representativeName={profile.full_name ?? ""}
      models={assignedModels}
      hrefs={{
        model: (model) => `/representative/models/${model.id}`,
        onboarding: (model) =>
          `/representative/models/${model.id}/onboarding`,
      }}
    />
  );
}
