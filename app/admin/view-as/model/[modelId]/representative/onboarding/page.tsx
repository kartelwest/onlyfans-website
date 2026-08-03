import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ViewAsBanner from "@/components/admin/ViewAsBanner";
import OnboardingChecklistPanel from "@/components/onboarding/OnboardingChecklistPanel";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * The onboarding checklist as the representative reaches it, at
 * /representative/models/[id]/onboarding.
 *
 * This is what answers "can the rep actually onboard this model": the same
 * panel, the same steps, the same fields. What it is NOT is a way to act as
 * the rep — every save still runs as the admin who is signed in, and
 * /api/models/onboarding resolves the permission from that real session (see
 * resolveOnboardingAccess). An admin editing here is an admin edit, and the
 * history records it as one.
 */
export default async function ViewAsRepresentativeOnboardingPage({
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

  const { data: model } = await supabase
    .from("models")
    .select("id, slug, display_name, stage_name, representative_id")
    .eq("id", modelId)
    .maybeSingle();

  if (!model) {
    notFound();
  }

  const { data: representative } = model.representative_id
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", model.representative_id)
        .maybeSingle()
    : { data: null };

  const representativeName =
    (representative?.full_name as string | null)?.trim() || null;

  return (
    <>
      <ViewAsBanner
        label={
          representativeName
            ? `Onboarding de ${model.display_name} como o representante ${representativeName} veria`
            : `Onboarding de ${model.display_name} como um representante veria (nenhum atribuído)`
        }
        backHref="/admin/representatives"
        switcher={{
          modelId: model.id as string,
          modelSlug: (model.slug as string | null) ?? null,
          current: "representative",
        }}
      />

      <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/admin/view-as/model/${model.id}/representative`}
            className="text-sm font-semibold text-pink-300 transition hover:text-pink-200"
          >
            ← Voltar para a modelo
          </Link>

          <header className="mt-6 rounded-2xl border border-white/10 bg-[#111115] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-200">
              Onboarding
            </p>

            <h1 className="mt-2 text-3xl font-bold">{model.display_name}</h1>

            {model.stage_name && (
              <p className="mt-2 text-sm text-white/55">
                Nome artístico: {model.stage_name}
              </p>
            )}

            <p className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-xs leading-6 text-white/55">
              Esta é a tela que o representante abre. As alterações feitas aqui
              são gravadas como alterações do administrador conectado, com o
              seu nome no histórico da modelo.
            </p>
          </header>

          <div className="mt-6">
            <OnboardingChecklistPanel
              modelId={model.id as string}
              currentUserRole={viewerRole}
            />
          </div>
        </div>
      </main>
    </>
  );
}
