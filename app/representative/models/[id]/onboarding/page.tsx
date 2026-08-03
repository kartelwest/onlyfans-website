import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import OnboardingChecklistPanel from "@/components/onboarding/OnboardingChecklistPanel";
import { isStaffRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

export default async function RepresentativeOnboardingPage({
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

  // Staff outrank a representative: the checklist a rep edits here is the same
  // one an admin edits on the model's own page, so send them there instead of
  // to the login screen.
  if (isStaffRole(profile.role as ManagementRole)) {
    const { data: staffModel } = await supabase
      .from("models")
      .select("slug")
      .eq("id", id)
      .maybeSingle();

    redirect(
      staffModel?.slug
        ? `/admin/models/${staffModel.slug}`
        : "/admin/models",
    );
  }

  if (
    profile.role !== "representative" ||
    profile.status !== "ativa"
  ) {
    redirect("/login");
  }

  // representative_id is enforced here and by RLS alike — a model who is not
  // assigned to this rep simply does not come back.
  const { data: model } = await supabase
    .from("models")
    .select("id, display_name, stage_name, onboarding_percentage")
    .eq("id", id)
    .eq("representative_id", user.id)
    .maybeSingle();

  if (!model) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/representative/models/${model.id}`}
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
        </header>

        <div className="mt-6">
          <OnboardingChecklistPanel
            modelId={model.id}
            currentUserRole="representative"
          />
        </div>
      </div>
    </main>
  );
}
