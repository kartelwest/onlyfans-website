import Link from "next/link";
import { redirect } from "next/navigation";

import ModelRowActions from "@/components/admin/ModelRowActions";
import ModelStatusDropdown from "@/components/admin/ModelStatusDropdown";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole, ModelStatus } from "@/types/model";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_MODELS = 30;

const STATUS_FILTERS: { value: "all" | ModelStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "candidate", label: "Candidatas" },
  { value: "active", label: "Ativas" },
  { value: "inactive", label: "Inativas" },
  { value: "denied", label: "Negadas" },
];

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
  profile: { full_name: string | null } | null;
};

type DashboardModel = ModelRow & {
  checklist: ChecklistRow | null;
};

type SimpleProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  active: boolean | null;
  created_at: string | null;
};

type AdminModelsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminModelsPage({
  searchParams,
}: AdminModelsPageProps) {
  const { status: statusParam } = await searchParams;

  const statusFilter: "all" | ModelStatus = STATUS_FILTERS.some(
    (filter) => filter.value === statusParam,
  )
    ? (statusParam as "all" | ModelStatus)
    : "all";

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

  const { data: modelRows, error: modelsError } =
    await supabase
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
          latest_note_summary,
          profile:profiles!profile_id ( full_name )
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
  }

  const { data: checklistRows, error: checklistError } =
    await supabase
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

  const { data: representativeRows, error: representativesError } =
    await supabase
      .from("profiles")
      .select("id, full_name, email, active, created_at")
      .eq("role", "representative")
      .order("full_name", { ascending: true });

  if (representativesError) {
    console.error(
      "Erro ao carregar representantes:",
      representativesError,
    );
  }

  const { data: administratorRows, error: administratorsError } =
    await supabase
      .from("profiles")
      .select("id, full_name, email, active, created_at")
      .eq("role", "administrator")
      .order("full_name", { ascending: true });

  if (administratorsError) {
    console.error(
      "Erro ao carregar administradores:",
      administratorsError,
    );
  }

  const representatives =
    (representativeRows ?? []) as SimpleProfileRow[];

  const administrators =
    (administratorRows ?? []) as SimpleProfileRow[];

  const models: DashboardModel[] = (modelRows ?? []).map(
    (model) => ({
      ...(model as unknown as ModelRow),
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

  const filteredModels =
    statusFilter === "all"
      ? models
      : models.filter(
          (model) =>
            normalizeModelStatus(model.status, model.active) ===
            statusFilter,
        );

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
              KARAY Models
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
              href="/admin/assistant"
              className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
            >
              Assistente Claude
            </Link>

            <Link
              href="/admin/import"
              className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
            >
              Importar PDF/Imagem
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

        <details
          open
          className="group mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-pink-400/20 bg-[#2a1521] px-6 py-4 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
              Modelos{" "}
              <span className="font-semibold text-pink-300/70">
                ({filteredModels.length}
                {statusFilter !== "all" ? ` de ${models.length}` : ""})
              </span>
            </span>

            <ChevronIcon />
          </summary>

          <div className="flex flex-wrap gap-2 border-b border-pink-400/20 bg-[#171017] px-6 py-4">
            {STATUS_FILTERS.map((filter) => {
              const isActive = filter.value === statusFilter;

              const count =
                filter.value === "all"
                  ? models.length
                  : models.filter(
                      (model) =>
                        normalizeModelStatus(
                          model.status,
                          model.active,
                        ) === filter.value,
                    ).length;

              return (
                <Link
                  key={filter.value}
                  href={
                    filter.value === "all"
                      ? "/admin/models"
                      : `/admin/models?status=${filter.value}`
                  }
                  className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                    isActive
                      ? "border-pink-400/60 bg-pink-500/20 text-pink-200"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {filter.label} ({count})
                </Link>
              );
            })}
          </div>

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
                {filteredModels.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-16 text-center"
                    >
                      <p className="text-lg font-bold">
                        {statusFilter === "all"
                          ? "Nenhuma modelo cadastrada"
                          : "Nenhuma modelo neste status"}
                      </p>

                      <p className="mt-2 text-sm text-white/50">
                        {statusFilter === "all"
                          ? "Adicione a primeira modelo para começar."
                          : "Tente selecionar outro filtro de status."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredModels.map((model, index) => {
                    const onboarding =
                      model.checklist
                        ?.onboarding_percentage ?? 0;

                    const canManage =
                      role === "owner" ||
                      role === "administrator";

                    const displayName =
                      model.profile?.full_name?.trim() ||
                      model.display_name;

                    return (
                      <tr
                        key={model.id}
                        className={`border-b border-white/10 transition hover:bg-white/[0.03] ${
                          !model.active ? "opacity-50" : ""
                        }`}
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
                            {displayName}
                          </Link>

                          {model.stage_name &&
                            model.stage_name !==
                              displayName && (
                              <p className="mt-1 text-xs text-white/45">
                                {model.stage_name}
                              </p>
                            )}
                        </TableCell>

                        <TableCell>
                          <ModelStatusDropdown
                            modelId={model.id}
                            status={normalizeModelStatus(
                              model.status,
                              model.active,
                            )}
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
                          <div className="flex flex-col gap-2">
                            <Link
                              href={`/admin/models/${model.slug}`}
                              className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                            >
                              Abrir perfil
                            </Link>

                            {canManage && (
                              <ModelRowActions
                                modelId={model.id}
                                displayName={displayName}
                              />
                            )}
                          </div>
                        </TableCell>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {models.length > 0 && (
            <ViewAsPicker
              options={models.map((model) => ({
                id: model.id,
                label:
                  model.profile?.full_name?.trim() ||
                  model.display_name,
              }))}
              basePath="/admin/view-as/model"
              fieldLabel="Visualizar como a modelo veria"
            />
          )}
        </details>

        <ProfileListSection
          title="Representantes"
          profiles={representatives}
          emptyMessage="Nenhum representante cadastrado."
          isOwner={role === "owner"}
          viewAsBasePath="/admin/view-as/representative"
          viewAsFieldLabel="Visualizar como o representante veria"
        />

        <ProfileListSection
          title="Administradores"
          profiles={administrators}
          emptyMessage="Nenhum administrador cadastrado."
          isOwner={role === "owner"}
        />

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

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0 text-pink-200 transition-transform duration-200 group-open:rotate-90"
    >
      <path
        d="M7 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileListSection({
  title,
  profiles,
  emptyMessage,
  isOwner,
  viewAsBasePath,
  viewAsFieldLabel,
}: {
  title: string;
  profiles: SimpleProfileRow[];
  emptyMessage: string;
  isOwner: boolean;
  viewAsBasePath?: string;
  viewAsFieldLabel?: string;
}) {
  return (
    <details className="group mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-pink-400/20 bg-[#2a1521] px-6 py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
          {title}{" "}
          <span className="font-semibold text-pink-300/70">
            ({profiles.length})
          </span>
        </span>

        <ChevronIcon />
      </summary>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead className="bg-[#2a1521] text-left">
            <tr className="border-b border-pink-400/20">
              <TableHeading>Nome</TableHeading>
              <TableHeading>Email</TableHeading>
              <TableHeading>Status</TableHeading>
              {isOwner && <TableHeading>Ações</TableHeading>}
            </tr>
          </thead>

          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td
                  colSpan={isOwner ? 4 : 3}
                  className="px-6 py-12 text-center text-sm text-white/50"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              profiles.map((profile) => (
                <tr
                  key={profile.id}
                  className={`border-b border-white/10 transition hover:bg-white/[0.03] ${
                    !profile.active ? "opacity-50" : ""
                  }`}
                >
                  <TableCell>
                    <span className="font-bold text-white">
                      {profile.full_name || "Sem nome"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-white/60">
                      {profile.email || "—"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                        profile.active
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                          : "bg-red-500/10 text-red-300 ring-red-500/30"
                      }`}
                    >
                      {profile.active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>

                  {isOwner && (
                    <TableCell>
                      <Link
                        href={`/owner/users/${profile.id}`}
                        className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                      >
                        Gerenciar
                      </Link>
                    </TableCell>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewAsBasePath && profiles.length > 0 && (
        <ViewAsPicker
          options={profiles.map((profile) => ({
            id: profile.id,
            label: profile.full_name || "Sem nome",
          }))}
          basePath={viewAsBasePath}
          fieldLabel={
            viewAsFieldLabel ?? "Visualizar como"
          }
        />
      )}
    </details>
  );
}

function ViewAsPicker({
  options,
  basePath,
  fieldLabel,
}: {
  options: { id: string; label: string }[];
  basePath: string;
  fieldLabel: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";

        const targetId = String(
          formData.get("targetId") ?? "",
        );

        if (targetId) {
          redirect(`${basePath}/${targetId}`);
        }
      }}
      className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-black/20 px-6 py-4"
    >
      <label className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">
        {fieldLabel}
      </label>

      <select
        name="targetId"
        required
        defaultValue=""
        className="min-w-[220px] rounded-lg border border-white/15 bg-[#1a1a1f] px-4 py-2 text-sm text-white outline-none focus:border-pink-400/60"
      >
        <option value="" disabled>
          Selecione...
        </option>

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-lg bg-pink-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-pink-400"
      >
        Visualizar
      </button>
    </form>
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

function normalizeModelStatus(
  status: string | null,
  active: boolean | null,
): ModelStatus {
  if (
    status === "active" ||
    status === "inactive" ||
    status === "candidate" ||
    status === "denied"
  ) {
    return status;
  }

  return active ? "active" : "inactive";
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