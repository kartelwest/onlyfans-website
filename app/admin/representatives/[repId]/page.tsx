import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StaffAccountActions from "@/components/admin/StaffAccountActions";
import { isStaffRole } from "@/lib/auth/roles";
import { normalizeModelStatus } from "@/lib/models/modelStatusOrder";
import {
  accountStatus,
  STAFF_STATUS_BADGE,
  STAFF_STATUS_LABELS,
  type StaffProfileRow,
} from "@/lib/staff/representatives";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

type AssignedModel = {
  id: string;
  slug: string;
  display_name: string;
  stage_name: string | null;
  status: string | null;
  active: boolean | null;
  onboarding_percentage: number | null;
  last_login_at: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  account_status_changed: "Status da conta alterado",
  account_deleted: "Conta excluída",
  view_as_representative: "Visualização como representante",
  view_as_model: "Visualização como a modelo",
};

export default async function RepresentativeProfilePage({
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

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!viewer || !viewer.active) {
    redirect("/login");
  }

  const viewerRole = viewer.role as ManagementRole;

  if (!isStaffRole(viewerRole)) {
    redirect("/login");
  }

  // The lifecycle columns may not be on the database yet — fall back to the
  // columns that have always existed rather than failing the whole page.
  const extended = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, archived_at, phone, last_login_at, created_at",
    )
    .eq("id", repId)
    .eq("role", "representative")
    .maybeSingle();

  const profileRow = extended.error
    ? (
        await supabase
          .from("profiles")
          .select("id, full_name, email, role, active, created_at")
          .eq("id", repId)
          .eq("role", "representative")
          .maybeSingle()
      ).data
    : extended.data;

  if (!profileRow) {
    notFound();
  }

  const representative = {
    archived_at: null,
    phone: null,
    last_login_at: null,
    ...(profileRow as Record<string, unknown>),
  } as unknown as StaffProfileRow;

  const { data: modelRows } = await supabase
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
        last_login_at
      `,
    )
    .eq("representative_id", repId)
    .order("display_name", { ascending: true });

  const models = (modelRows ?? []) as unknown as AssignedModel[];

  // staff_audit_log arrives with its own migration; an older database simply
  // shows no history yet.
  const { data: auditRows } = await supabase
    .from("staff_audit_log")
    .select(
      "id, action, actor_name, actor_role, previous_value, new_value, created_at",
    )
    .eq("target_id", repId)
    .order("created_at", { ascending: false })
    .limit(20);

  const activity = (auditRows ?? []) as unknown as AuditRow[];

  const status = accountStatus(representative);

  const onboardingAverage =
    models.length === 0
      ? 0
      : Math.round(
          models.reduce(
            (total, model) => total + (model.onboarding_percentage ?? 0),
            0,
          ) / models.length,
        );

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/representatives"
          className="text-sm font-semibold text-pink-300 transition hover:text-pink-200"
        >
          ← Voltar para representantes
        </Link>

        <header className="mt-6 flex flex-col gap-6 rounded-2xl border border-white/10 bg-[#111115] p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              Representante
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {representative.full_name || "Sem nome"}
            </h1>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="E-mail" value={representative.email || "—"} />
              <Info
                label="Telefone / WhatsApp"
                value={representative.phone || "Não informado"}
              />
              <Info
                label="Cadastro"
                value={formatDateTime(representative.created_at)}
              />
              <Info
                label="Último acesso"
                value={
                  representative.last_login_at
                    ? formatDateTime(representative.last_login_at)
                    : "Nunca"
                }
              />
              <Info
                label="Modelos atribuídas"
                value={`${models.length}`}
              />
              <Info
                label="Onboarding médio"
                value={`${onboardingAverage}%`}
              />
            </div>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <span
              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${STAFF_STATUS_BADGE[status]}`}
            >
              {STAFF_STATUS_LABELS[status]}
            </span>

            <Link
              href={`/admin/view-as/representative/${representative.id}`}
              className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-3 text-center text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
            >
              Ver como ele vê
            </Link>

            <StaffAccountActions
              userId={representative.id}
              displayName={representative.full_name || "Esta conta"}
              status={status}
              canDelete={viewerRole === "owner"}
              assignedModels={models.length}
            />
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <h2 className="border-b border-pink-400/20 bg-[#2a1521] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            Modelos atribuídas ({models.length})
          </h2>

          {models.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-white/50">
              Nenhuma modelo atribuída a este representante.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {models.map((model) => {
                const modelStatus = normalizeModelStatus(
                  model.status,
                  model.active,
                );

                return (
                  <div
                    key={model.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {model.display_name}
                      </p>

                      <p className="mt-1 text-xs text-white/45">
                        {STATUS_TEXT[modelStatus]} · Onboarding{" "}
                        {model.onboarding_percentage ?? 0}%
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/view-as/model/${model.id}/representative`}
                        className="rounded-lg border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
                      >
                        Como o rep. vê
                      </Link>

                      <Link
                        href={`/admin/view-as/model/${model.id}/representative/onboarding`}
                        className="rounded-lg border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
                      >
                        Onboarding do rep.
                      </Link>

                      <Link
                        href={`/admin/models/${model.slug}`}
                        className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                      >
                        Painel admin
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <h2 className="border-b border-pink-400/20 bg-[#2a1521] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            Histórico da conta
          </h2>

          {activity.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-white/50">
              Nenhum registro ainda. Mudanças de status e visualizações como
              este representante aparecem aqui.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {activity.map((entry) => (
                <li key={entry.id} className="px-6 py-4">
                  <p className="text-sm font-semibold">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>

                  <p className="mt-1 text-xs text-white/50">
                    {entry.previous_value && entry.new_value
                      ? `${entry.previous_value} → ${entry.new_value} · `
                      : ""}
                    {entry.actor_name || "Sistema"} ·{" "}
                    {formatDateTime(entry.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

const STATUS_TEXT: Record<string, string> = {
  active: "Ativa",
  inactive: "Inativa",
  candidate: "Candidata",
  denied: "Negada",
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-white/85">{value}</p>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("pt-BR");
}
