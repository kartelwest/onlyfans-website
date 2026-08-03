import Link from "next/link";
import { redirect } from "next/navigation";

import RepresentativeModelsDropdown, {
  type RepresentativeModel,
} from "@/components/admin/RepresentativeModelsDropdown";
import StaffAccountActions from "@/components/admin/StaffAccountActions";
import { isStaffRole } from "@/lib/auth/roles";
import {
  accountStatus,
  loadStaffProfiles,
  STAFF_STATUS_BADGE,
  STAFF_STATUS_LABELS,
  type StaffAccountStatus,
} from "@/lib/staff/representatives";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: "all" | StaffAccountStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "archived", label: "Arquivados" },
];

export default async function AdminRepresentativesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  const search = (q ?? "").trim();

  const statusFilter: "all" | StaffAccountStatus = STATUS_FILTERS.some(
    (filter) => filter.value === status,
  )
    ? (status as "all" | StaffAccountStatus)
    : "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewer } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!viewer || !viewer.active) {
    redirect("/login");
  }

  const viewerRole = viewer.role as ManagementRole;

  if (!isStaffRole(viewerRole)) {
    redirect("/login");
  }

  const { profiles: representatives, lifecycleReady } = await loadStaffProfiles(
    supabase,
    "representative",
  );

  const { data: modelRows, error: modelsError } = await supabase
    .from("models")
    .select(
      `
        id,
        slug,
        display_name,
        stage_name,
        status,
        active,
        onboarding_percentage,
        representative_id
      `,
    )
    .order("display_name", { ascending: true });

  if (modelsError) {
    console.error("Erro ao carregar modelos:", modelsError);
  }

  const modelsByRepresentative = new Map<string, RepresentativeModel[]>();

  for (const row of modelRows ?? []) {
    const repId = (row as { representative_id: string | null })
      .representative_id;

    if (!repId) {
      continue;
    }

    const list = modelsByRepresentative.get(repId) ?? [];

    list.push(row as unknown as RepresentativeModel);

    modelsByRepresentative.set(repId, list);
  }

  const unassignedModels = (modelRows ?? []).filter(
    (row) => !(row as { representative_id: string | null }).representative_id,
  ).length;

  const needle = search.toLowerCase();

  const filtered = representatives.filter((profile) => {
    if (
      statusFilter !== "all" &&
      accountStatus(profile) !== statusFilter
    ) {
      return false;
    }

    if (!needle) {
      return true;
    }

    return [profile.full_name, profile.email, profile.phone]
      .filter((field): field is string => Boolean(field))
      .some((field) => field.toLowerCase().includes(needle));
  });

  const counts = STATUS_FILTERS.map((filter) => ({
    ...filter,
    count:
      filter.value === "all"
        ? representatives.length
        : representatives.filter(
            (profile) => accountStatus(profile) === filter.value,
          ).length,
  }));

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY Models
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Representantes
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Ative, desative ou arquive uma conta, veja as modelos de cada
              representante e abra a tela exatamente como ele a vê.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/models"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Lista de modelos
            </Link>

            <Link
              href="/admin/users/new?role=representative"
              className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400"
            >
              Adicionar representante
            </Link>
          </div>
        </header>

        {!lifecycleReady && (
          <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
            O banco ainda não tem as colunas de ciclo de vida
            (<code>archived_at</code>, <code>phone</code>,{" "}
            <code>last_login_at</code>). A lista funciona com ativo e inativo;
            arquivar só passa a funcionar depois da migração
            <code> 20260803010000_representative_lifecycle_and_staff_audit</code>.
          </p>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {counts.map((item) => (
            <div
              key={item.value}
              className="rounded-2xl border border-white/10 bg-[#111115] p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                {item.label}
              </p>

              <p className="mt-3 text-3xl font-bold text-pink-300">
                {item.count}
              </p>
            </div>
          ))}
        </section>

        {unassignedModels > 0 && (
          <p className="mt-4 rounded-2xl border border-white/10 bg-[#111115] p-4 text-sm text-white/60">
            {unassignedModels} modelo(s) estão sem representante atribuído.
          </p>
        )}

        <form
          method="get"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#111115] p-4"
        >
          <input type="hidden" name="status" value={statusFilter} />

          <label
            htmlFor="rep-search"
            className="text-xs font-bold uppercase tracking-[0.12em] text-white/50"
          >
            Buscar
          </label>

          <input
            id="rep-search"
            name="q"
            defaultValue={search}
            placeholder="Nome, e-mail ou telefone"
            className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-[#1a1a1f] px-4 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-pink-400/60"
          />

          <button
            type="submit"
            className="rounded-lg bg-pink-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-pink-400"
          >
            Buscar
          </button>

          {search && (
            <Link
              href={`/admin/representatives?status=${statusFilter}`}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10"
            >
              Limpar
            </Link>
          )}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map((filter) => {
            const isActive = filter.value === statusFilter;

            const href = search
              ? `/admin/representatives?status=${filter.value}&q=${encodeURIComponent(search)}`
              : `/admin/representatives?status=${filter.value}`;

            return (
              <Link
                key={filter.value}
                href={href}
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                  isActive
                    ? "border-pink-400/60 bg-pink-500/20 text-pink-200"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {filter.label} ({filter.count})
              </Link>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead className="bg-[#2a1521] text-left">
                <tr className="border-b border-pink-400/20">
                  <TableHeading>Representante</TableHeading>
                  <TableHeading>Contato</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>Modelos</TableHeading>
                  <TableHeading>Cadastro</TableHeading>
                  <TableHeading>Último acesso</TableHeading>
                  <TableHeading>Ações</TableHeading>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <p className="text-lg font-bold">
                        Nenhum representante encontrado
                      </p>

                      <p className="mt-2 text-sm text-white/50">
                        {search || statusFilter !== "all"
                          ? "Ajuste a busca ou o filtro de status."
                          : "Adicione o primeiro representante para começar."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((profile) => {
                    const status = accountStatus(profile);

                    const models =
                      modelsByRepresentative.get(profile.id) ?? [];

                    return (
                      <tr
                        key={profile.id}
                        className={`border-b border-white/10 align-top transition hover:bg-white/[0.03] ${
                          status === "active" ? "" : "opacity-60"
                        }`}
                      >
                        <TableCell>
                          <Link
                            href={`/admin/representatives/${profile.id}`}
                            className="font-bold text-white transition hover:text-pink-300"
                          >
                            {profile.full_name || "Sem nome"}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <p className="text-sm text-white/60">
                            {profile.email || "—"}
                          </p>

                          <p className="mt-1 text-xs text-white/40">
                            {profile.phone || "Telefone não informado"}
                          </p>
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${STAFF_STATUS_BADGE[status]}`}
                          >
                            {STAFF_STATUS_LABELS[status]}
                          </span>
                        </TableCell>

                        <TableCell>
                          <RepresentativeModelsDropdown
                            representativeId={profile.id}
                            models={models}
                          />
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-white/55">
                            {formatDate(profile.created_at)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-white/55">
                            {profile.last_login_at
                              ? formatDate(profile.last_login_at)
                              : "Nunca"}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Link
                              href={`/admin/view-as/representative/${profile.id}`}
                              className="rounded-lg border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-center text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
                            >
                              Ver como ele vê
                            </Link>

                            <Link
                              href={`/admin/representatives/${profile.id}`}
                              className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-center text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                            >
                              Abrir perfil
                            </Link>

                            <StaffAccountActions
                              userId={profile.id}
                              displayName={profile.full_name || "Esta conta"}
                              status={status}
                              canDelete={viewerRole === "owner"}
                              assignedModels={models.length}
                            />
                          </div>
                        </TableCell>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

function TableHeading({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-top">{children}</td>;
}
