import Link from "next/link";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_MODELS = 30;

type ChecklistRow = {
  model_id: string;
  onboarding_percentage: number | null;
  onlyfans_status: string | null;
  fansly_status: string | null;
  google_drive_status: string | null;
  website_login_status: string | null;
};

type ModelRow = {
  id: string;
  model_number: number | null;
  slug: string;
  display_name: string;
  stage_name: string | null;
  status: string | null;
  active: boolean | null;
  website_login_enabled: boolean | null;
  latest_note_summary: string | null;
};

type DashboardModel = ModelRow & {
  checklist: ChecklistRow | null;
};

export default async function AdminModelsPage() {
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

  if (role === "representative") {
    redirect("/representative");
  }

  if (role === "model") {
    redirect("/area-da-modelo");
  }

  if (role !== "owner" && role !== "administrator") {
    redirect("/login");
  }

  const adminSupabase = createAdminClient();

  const { data: modelRows, error: modelsError } =
    await adminSupabase
      .from("models")
      .select(
        `
          id,
          model_number,
          slug,
          display_name,
          stage_name,
          status,
          active,
          website_login_enabled,
          latest_note_summary
        `,
      )
      .order("model_number", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: true,
      });

  if (modelsError) {
    console.error("Erro ao carregar modelos:", modelsError);

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080a] px-4 text-white">
        <section className="w-full max-w-xl rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
            Erro
          </p>

          <h1 className="mt-3 text-2xl font-bold">
            Não foi possível carregar as modelos
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-100/75">
            {modelsError.message}
          </p>
        </section>
      </main>
    );
  }

  const { data: checklistRows, error: checklistError } =
    await adminSupabase
      .from("model_checklist")
      .select(
        `
          model_id,
          onboarding_percentage,
          onlyfans_status,
          fansly_status,
          google_drive_status,
          website_login_status
        `,
      );

  if (checklistError) {
    console.error(
      "Erro ao carregar checklist:",
      checklistError,
    );
  }

  const checklistMap = new Map<string, ChecklistRow>();

  for (const checklist of checklistRows ?? []) {
    checklistMap.set(checklist.model_id, checklist);
  }

  const models: DashboardModel[] = (modelRows ?? []).map(
    (model) => ({
      ...model,
      checklist: checklistMap.get(model.id) ?? null,
    }),
  );

  const activeModels = models.filter(
    (model) => model.active,
  ).length;

  const onboardingModels = models.filter((model) => {
    const percentage =
      model.checklist?.onboarding_percentage ?? 0;

    return percentage > 0 && percentage < 100;
  }).length;

  const completedModels = models.filter(
    (model) =>
      (model.checklist?.onboarding_percentage ?? 0) ===
      100,
  ).length;

  const availableSpaces = Math.max(
    MAX_ACTIVE_MODELS - activeModels,
    0,
  );

  const capacityPercentage = Math.min(
    (activeModels / MAX_ACTIVE_MODELS) * 100,
    100,
  );

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARRAY Models
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Lista de modelos
            </h1>

            <p className="mt-2 text-sm text-white/55">
              Bem-vindo, {profile.full_name}.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Dashboard
            </Link>

            <Link
              href="/admin/users/new?role=model"
              className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400"
            >
              Adicionar modelo
            </Link>

            <Link
              href="/admin/users/new?role=representative"
              className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-5 py-3 text-sm font-semibold text-pink-200 transition hover:bg-pink-500/20"
            >
              Adicionar representante
            </Link>

            {role === "owner" && (
              <Link
                href="/admin/users/new?role=administrator"
                className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
              >
                Adicionar administrador
              </Link>
            )}
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Modelos ativas"
            value={`${activeModels} / ${MAX_ACTIVE_MODELS}`}
            description="Capacidade total"
          />

          <MetricCard
            label="Vagas disponíveis"
            value={availableSpaces}
            description="Até atingir o limite"
          />

          <MetricCard
            label="Em onboarding"
            value={onboardingModels}
            description="Processo em andamento"
          />

          <MetricCard
            label="Onboarding concluído"
            value={completedModels}
            description="100% completo"
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
                Limite operacional: 30 modelos
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
              style={{
                width: `${capacityPercentage}%`,
              }}
            />
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] border-collapse">
              <thead className="bg-[#2a1521] text-left">
                <tr className="border-b border-pink-400/20">
                  <TableHeading>#</TableHeading>
                  <TableHeading>Modelo</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>Onboarding</TableHeading>
                  <TableHeading>Website</TableHeading>
                  <TableHeading>Google Drive</TableHeading>
                  <TableHeading>OnlyFans</TableHeading>
                  <TableHeading>Fansly</TableHeading>
                  <TableHeading>Notas</TableHeading>
                  <TableHeading>Ações</TableHeading>
                </tr>
              </thead>

              <tbody>
                {models.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-16 text-center"
                    >
                      <p className="text-lg font-bold">
                        Nenhuma modelo cadastrada
                      </p>

                      <p className="mt-2 text-sm text-white/50">
                        Adicione a primeira modelo para
                        começar.
                      </p>
                    </td>
                  </tr>
                ) : (
                  models.map((model, index) => {
                    const onboarding =
                      model.checklist
                        ?.onboarding_percentage ?? 0;

                    return (
                      <tr
                        key={model.id}
                        className="border-b border-white/10 transition hover:bg-white/[0.03]"
                      >
                        <TableCell>
                          <span className="font-bold text-pink-300">
                            {model.model_number ??
                              index + 1}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/admin/models/${model.slug}`}
                            className="font-bold text-white transition hover:text-pink-300"
                          >
                            {model.display_name}
                          </Link>

                          {model.stage_name &&
                            model.stage_name !==
                              model.display_name && (
                              <p className="mt-1 text-xs text-white/45">
                                {model.stage_name}
                              </p>
                            )}
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={
                              model.active
                                ? model.status ||
                                  "active"
                                : "inactive"
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <OnboardingProgress
                            percentage={onboarding}
                          />
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={
                              model.checklist
                                ?.website_login_status ??
                              (model.website_login_enabled
                                ? "completed"
                                : "not_started")
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={
                              model.checklist
                                ?.google_drive_status ??
                              "not_started"
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={
                              model.checklist
                                ?.onlyfans_status ??
                              "not_started"
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={
                              model.checklist
                                ?.fansly_status ??
                              "not_started"
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <p className="max-w-[280px] truncate text-sm text-white/60">
                            {model.latest_note_summary ||
                              "Nenhuma nota"}
                          </p>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/admin/models/${model.slug}`}
                            className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                          >
                            Abrir perfil
                          </Link>
                        </TableCell>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-4 rounded-2xl border border-pink-400/20 bg-[#21121a] p-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
              Máximo de modelos ativas
            </p>

            <p className="mt-3 text-3xl font-bold">
              {MAX_ACTIVE_MODELS}
            </p>

            <p className="mt-2 text-sm text-white/60">
              Ativas atualmente: {activeModels}
            </p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
              Cada modelo terá
            </p>

            <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
              <p>✓ Login individual</p>
              <p>✓ Dashboard privado</p>
              <p>✓ Integração com Google Drive</p>
              <p>✓ Upload direto pelo site</p>
              <p>✓ Pastas separadas por plataforma</p>
              <p>✓ Checklist de onboarding</p>
            </div>
          </div>
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

function TableHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="px-5 py-4 align-middle">
      {children}
    </td>
  );
}

function OnboardingProgress({
  percentage,
}: {
  percentage: number;
}) {
  const safePercentage = Math.min(
    Math.max(percentage, 0),
    100,
  );

  const barColor =
    safePercentage === 100
      ? "bg-emerald-500"
      : safePercentage > 0
        ? "bg-yellow-400"
        : "bg-red-500";

  return (
    <div className="min-w-[140px]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/55">
          Progresso
        </span>

        <span className="font-bold">
          {safePercentage}%
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{
            width: `${safePercentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status?.toLowerCase() || "not_started";

  const statusConfig: Record<
    string,
    {
      label: string;
      className: string;
      dot: string;
    }
  > = {
    active: {
      label: "Ativa",
      className:
        "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
      dot: "bg-emerald-400",
    },
    completed: {
      label: "Concluído",
      className:
        "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
      dot: "bg-emerald-400",
    },
    in_progress: {
      label: "Em andamento",
      className:
        "border-yellow-400/30 bg-yellow-500/15 text-yellow-300",
      dot: "bg-yellow-400",
    },
    planned: {
      label: "Planejado",
      className:
        "border-yellow-400/30 bg-yellow-500/15 text-yellow-300",
      dot: "bg-yellow-400",
    },
    not_started: {
      label: "Não iniciado",
      className:
        "border-red-400/30 bg-red-500/15 text-red-300",
      dot: "bg-red-400",
    },
    missing: {
      label: "Pendente",
      className:
        "border-red-400/30 bg-red-500/15 text-red-300",
      dot: "bg-red-400",
    },
    blocked: {
      label: "Bloqueado",
      className:
        "border-red-400/30 bg-red-500/15 text-red-300",
      dot: "bg-red-400",
    },
    duplicate: {
      label: "Duplicado",
      className:
        "border-blue-400/30 bg-blue-500/15 text-blue-300",
      dot: "bg-blue-400",
    },
    inactive: {
      label: "Inativa",
      className:
        "border-white/15 bg-white/5 text-white/45",
      dot: "bg-white/40",
    },
    onboarded: {
      label: "Onboarded",
      className:
        "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
      dot: "bg-emerald-400",
    },
  };

  const config =
    statusConfig[normalizedStatus] ??
    statusConfig.not_started;

  return (
    <span
      className={`inline-flex whitespace-nowrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${config.dot}`}
      />

      {config.label}
    </span>
  );
}