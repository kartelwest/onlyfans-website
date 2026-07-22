import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_MODELS = 30;

type ModelRow = {
  id: string;
  display_name: string;
  model_number: number | null;
  active: boolean | null;
  onboarding_complete: boolean | null;
  onboarding_percentage: number | null;
  representative_id: string | null;
  created_at: string;
};

type EarningsRow = {
  model_share: number;
  agency_share: number;
  marketing_share: number;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  const role = profile.role as ManagementRole;

  if (role !== "owner" && role !== "administrator") {
    if (role === "representative") {
      redirect("/representative");
    }
    if (role === "model") {
      redirect("/area-da-modelo");
    }
    redirect("/login");
  }

  const { data: modelRows } = await supabase
    .from("models")
    .select(
      "id, display_name, model_number, active, onboarding_complete, onboarding_percentage, representative_id, created_at",
    )
    .order("created_at", { ascending: false });

  const models = (modelRows ?? []) as ModelRow[];

  const activeModels = models.filter((m) => m.active).length;
  const inactiveModels = models.filter((m) => !m.active).length;
  const completedOnboarding = models.filter(
    (m) => m.onboarding_complete,
  ).length;
  const inProgressOnboarding = models.filter(
    (m) =>
      !m.onboarding_complete &&
      (m.onboarding_percentage ?? 0) > 0,
  ).length;
  const notStartedOnboarding = models.filter(
    (m) => (m.onboarding_percentage ?? 0) === 0,
  ).length;

  const capacityPercentage = Math.min(
    (activeModels / MAX_ACTIVE_MODELS) * 100,
    100,
  );

  const { data: earningsRows } = await supabase
    .from("model_earnings_reports")
    .select("model_share, agency_share, marketing_share");

  const earnings = (earningsRows ?? []) as EarningsRow[];

  const totalModelShare = earnings.reduce(
    (sum, e) => sum + Number(e.model_share),
    0,
  );
  const totalAgencyShare = earnings.reduce(
    (sum, e) => sum + Number(e.agency_share),
    0,
  );
  const totalMarketingShare = earnings.reduce(
    (sum, e) => sum + Number(e.marketing_share),
    0,
  );

  const repIds = [
    ...new Set(
      models
        .map((m) => m.representative_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const { data: repProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", repIds);

  const repMap = new Map<string, string>();
  for (const rep of (repProfiles ?? []) as ProfileRow[]) {
    repMap.set(rep.id, rep.full_name ?? "Sem nome");
  }

  const modelsByRep = repIds.map((repId) => ({
    repName: repMap.get(repId) ?? "Sem nome",
    count: models.filter((m) => m.representative_id === repId).length,
  }));

  const recentModels = models.slice(0, 5);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARRAY Models
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-white/55">
              Bem-vindo, {profile.full_name}.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/models"
              className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400"
            >
              Ver modelos
            </Link>

            <Link
              href="/admin/users/new?role=model"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Adicionar modelo
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Modelos ativas"
            value={`${activeModels} / ${MAX_ACTIVE_MODELS}`}
            description="Capacidade total"
          />

          <MetricCard
            label="Onboarding concluído"
            value={completedOnboarding}
            description="Modelos prontas"
          />

          <MetricCard
            label="Em onboarding"
            value={inProgressOnboarding}
            description="Processo em andamento"
          />

          <MetricCard
            label="Total cadastrado"
            value={models.length}
            description="Todos os registros"
          />
        </section>

        <section className="mt-5 rounded-2xl border border-pink-400/20 bg-[#111115] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold">
                Capacidade de modelos ativas
              </p>

              <p className="mt-1 text-xs text-white/50">
                Limite operacional: {MAX_ACTIVE_MODELS} modelos
              </p>
            </div>

            <p className="text-lg font-bold text-pink-300">
              {activeModels} / {MAX_ACTIVE_MODELS}
            </p>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${
                activeModels >= MAX_ACTIVE_MODELS
                  ? "bg-red-500"
                  : activeModels >= 25
                    ? "bg-yellow-400"
                    : "bg-pink-500"
              }`}
              style={{ width: `${capacityPercentage}%` }}
            />
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#111115] p-6">
            <h2 className="text-lg font-bold text-pink-300">
              Funil de Onboarding
            </h2>

            <div className="mt-4 space-y-3">
              <FunilRow
                label="Não iniciado"
                count={notStartedOnboarding}
                total={models.length}
                color="bg-red-400"
              />
              <FunilRow
                label="Em andamento"
                count={inProgressOnboarding}
                total={models.length}
                color="bg-yellow-400"
              />
              <FunilRow
                label="Concluído"
                count={completedOnboarding}
                total={models.length}
                color="bg-emerald-400"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111115] p-6">
            <h2 className="text-lg font-bold text-pink-300">
              Modelos por Representante
            </h2>

            {modelsByRep.length === 0 ? (
              <p className="mt-4 text-sm text-white/45">
                Nenhum representante atribuído.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {modelsByRep.map((rep) => (
                  <div
                    key={rep.repName}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-white/80">
                      {rep.repName}
                    </span>
                    <span className="text-sm font-bold text-pink-300">
                      {rep.count} modelo{rep.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#111115] p-6">
          <h2 className="text-lg font-bold text-pink-300">
            Snapshot de Ganhos
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <EarningsCard
              label="Parte das modelos"
              value={totalModelShare}
            />
            <EarningsCard
              label="Parte da agência"
              value={totalAgencyShare}
            />
            <EarningsCard
              label="Parte do marketing"
              value={totalMarketingShare}
            />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#111115] p-6">
          <h2 className="text-lg font-bold text-pink-300">
            Atividade Recente
          </h2>

          {recentModels.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">
              Nenhuma modelo cadastrada ainda.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/admin/models/${model.id}`}
                      className="text-sm font-bold text-white transition hover:text-pink-300"
                    >
                      {model.display_name}
                    </Link>
                    <p className="mt-1 text-xs text-white/45">
                      Cadastrada em{" "}
                      {new Date(model.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      model.active
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : "border-white/15 bg-white/5 text-white/45"
                    }`}
                  >
                    {model.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111115] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-pink-300">
        {value}
      </p>

      <p className="mt-2 text-xs text-white/45">
        {description}
      </p>
    </div>
  );
}

function FunilRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-bold text-white">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EarningsCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-white">
        {formatted}
      </p>
    </div>
  );
}
