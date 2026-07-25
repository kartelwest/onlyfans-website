import { notFound } from "next/navigation";

import BoundariesForm from "@/components/amplia/BoundariesForm";
import BrandProfileForm from "@/components/amplia/BrandProfileForm";
import ConsentsPanel from "@/components/amplia/ConsentsPanel";
import GoalsPanel from "@/components/amplia/GoalsPanel";
import PageHeader from "@/components/amplia/PageHeader";
import { createClient } from "@/lib/supabase/server";
import type { BrandProfile, ClientBoundaries, GrowthGoal } from "@/types/amplia";

export const dynamic = "force-dynamic";

type TalentDetailPageProps = {
  params: Promise<{ talentId: string }>;
};

export default async function TalentDetailPage({
  params,
}: TalentDetailPageProps) {
  const { talentId } = await params;
  const supabase = await createClient();

  const { data: talent } = await supabase
    .from("talents")
    .select(
      "id, stage_name, display_name, legal_name, linked_model_id, active",
    )
    .eq("id", talentId)
    .single();

  if (!talent) {
    notFound();
  }

  const [
    { data: profileRow },
    { data: consentRows },
    { data: boundariesRow },
    { data: goalRows },
  ] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select(
        "id, talent_id, niche_1, niche_2, niche_3, ai_guidance, primary_positioning, secondary_positioning, brand_voice, target_countries, target_cities, target_languages, target_gender, target_age_min, target_age_max, target_interests, desired_partnerships, markets_to_avoid, topics_to_avoid, status, updated_at",
      )
      .eq("talent_id", talentId)
      .maybeSingle(),
    supabase
      .from("client_consent_status")
      .select("consent_type, granted, effective_date, notes")
      .eq("talent_id", talentId),
    supabase
      .from("client_boundaries")
      .select(
        "id, talent_id, prohibited_subjects, prohibited_words, political_boundary, religious_boundary, sexual_boundary, clothing_boundary, comment_boundary, dm_boundary, accounts_not_to_mention, private_details_never_reveal, crisis_topics",
      )
      .eq("talent_id", talentId)
      .maybeSingle(),
    supabase
      .from("growth_goals")
      .select(
        "id, talent_id, platform, objective, priority, start_value, target_value, target_date, measurement_method, status",
      )
      .eq("talent_id", talentId)
      .order("created_at", { ascending: false }),
  ]);

  const profile: BrandProfile | null = profileRow
    ? {
        id: profileRow.id,
        talentId: profileRow.talent_id,
        niche1: profileRow.niche_1,
        niche2: profileRow.niche_2,
        niche3: profileRow.niche_3,
        aiGuidance: profileRow.ai_guidance,
        primaryPositioning: profileRow.primary_positioning,
        secondaryPositioning: profileRow.secondary_positioning ?? [],
        brandVoice: profileRow.brand_voice,
        targetCountries: profileRow.target_countries ?? [],
        targetCities: profileRow.target_cities ?? [],
        targetLanguages: profileRow.target_languages ?? [],
        targetGender: profileRow.target_gender,
        targetAgeMin: profileRow.target_age_min,
        targetAgeMax: profileRow.target_age_max,
        targetInterests: profileRow.target_interests ?? [],
        desiredPartnerships: profileRow.desired_partnerships,
        marketsToAvoid: profileRow.markets_to_avoid ?? [],
        topicsToAvoid: profileRow.topics_to_avoid ?? [],
        status: profileRow.status,
        updatedAt: profileRow.updated_at,
      }
    : null;

  const boundaries: ClientBoundaries | null = boundariesRow
    ? {
        id: boundariesRow.id,
        talentId: boundariesRow.talent_id,
        prohibitedSubjects: boundariesRow.prohibited_subjects ?? [],
        prohibitedWords: boundariesRow.prohibited_words ?? [],
        politicalBoundary: boundariesRow.political_boundary,
        religiousBoundary: boundariesRow.religious_boundary,
        sexualBoundary: boundariesRow.sexual_boundary,
        clothingBoundary: boundariesRow.clothing_boundary,
        commentBoundary: boundariesRow.comment_boundary,
        dmBoundary: boundariesRow.dm_boundary,
        accountsNotToMention: boundariesRow.accounts_not_to_mention ?? [],
        privateDetailsNeverReveal:
          boundariesRow.private_details_never_reveal ?? [],
        crisisTopics: boundariesRow.crisis_topics ?? [],
      }
    : null;

  const goals: GrowthGoal[] = (goalRows ?? []).map((row) => ({
    id: row.id,
    talentId: row.talent_id,
    platform: row.platform,
    objective: row.objective,
    priority: row.priority,
    startValue: row.start_value,
    targetValue: row.target_value,
    targetDate: row.target_date,
    measurementMethod: row.measurement_method,
    status: row.status,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={talent.display_name}
        description={
          talent.linked_model_id
            ? "Trilha: OnlyFans + Brand Growth. Os dados operacionais de OnlyFans continuam no CRM principal — esta página cobre apenas o Brand Growth."
            : "Trilha: Brand Growth exclusivo (sem OnlyFans)."
        }
      />

      <Section title="Identidade">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome artístico" value={talent.stage_name} />
          <Field label="Nome de exibição" value={talent.display_name} />
          <Field
            label="Nome legal"
            value={
              talent.legal_name
                ? "Definido (privado — nunca enviado à IA sem consentimento)"
                : "Não informado"
            }
          />
          <Field label="Status" value={talent.active ? "Ativa" : "Inativa"} />
        </dl>
      </Section>

      <Section title="Perfil de marca">
        {profile ? (
          <BrandProfileForm talentId={talent.id} profile={profile} />
        ) : (
          <p className="text-sm text-white/50">
            Esta cliente ainda não tem um perfil de marca.
          </p>
        )}
      </Section>

      <Section title="Objetivos de crescimento">
        <GoalsPanel talentId={talent.id} goals={goals} />
      </Section>

      <Section title="Consentimentos">
        <ConsentsPanel
          talentId={talent.id}
          currentStatus={consentRows ?? []}
        />
      </Section>

      <Section title="Limites da cliente">
        <BoundariesForm talentId={talent.id} boundaries={boundaries} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
      <div className="border-b border-purple-400/20 bg-[#1c1730] px-6 py-4">
        <p className="text-sm font-bold uppercase tracking-[0.1em] text-purple-100">
          {title}
        </p>
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-white/80">{value}</dd>
    </div>
  );
}
