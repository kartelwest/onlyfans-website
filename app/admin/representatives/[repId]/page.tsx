import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import RepresentativeModelsDropdown, {
  type RepresentativeModel,
} from "@/components/admin/RepresentativeModelsDropdown";
import { isStaffRole } from "@/lib/auth/roles";
import { normalizeModelStatus } from "@/lib/models/modelStatusOrder";
import {
  accountStatus,
  STAFF_STATUS_BADGE,
  STAFF_STATUS_LABELS,
} from "@/lib/staff/representatives";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

import RepresentativeDetailsForm from "./RepresentativeDetailsForm";

export const dynamic = "force-dynamic";

/**
 * One representative, in full: who she is, what she holds, what she wrote and
 * what has been done to her account.
 *
 * The list screen answers "who do we have"; this answers "what is going on with
 * this one" — which is the screen you want open while she is on the phone.
 */

type AssignedModel = RepresentativeModel & {
  last_login_at: string | null;
};

type RepNote = {
  id: string;
  model_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  actor_name: string | null;
  previous_value: unknown;
  new_value: unknown;
  summary: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  representative_status_changed: "Status alterado",
  representative_details_updated: "Dados atualizados",
  account_status_changed: "Status da conta alterado",
  account_deleted: "Conta excluída",
  view_as_representative_enter: "Entrou na visualização como o representante",
  view_as_representative_exit: "Saiu da visualização",
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

  if (!viewer || !viewer.active || !isStaffRole(viewer.role as ManagementRole)) {
    redirect("/login");
  }

  const { data: representative } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, active, status, last_login_at, status_changed_at, created_at",
    )
    .eq("id", repId)
    .eq("role", "representative")
    .maybeSingle();

  if (!representative) {
    notFound();
  }

  const [{ data: modelRows }, { data: noteRows }, { data: auditRows }] =
    await Promise.all([
      supabase
        .from("models")
        .select(
          "id, slug, display_name, stage_name, status, active, onboarding_percentage, last_login_at",
        )
        .eq("representative_id", repId)
        .order("display_name", { ascending: true }),
      supabase
        .from("model_notes")
        .select("id, model_id, body, created_at, deleted_at")
        .eq("created_by", repId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("system_audit_log")
        .select(
          "id, action, actor_name, previous_value, new_value, summary, created_at",
        )
        .eq("target_id", repId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const models = (modelRows ?? []) as unknown as AssignedModel[];
  const notes = (noteRows ?? []) as unknown as RepNote[];
  const activity = (auditRows ?? []) as unknown as AuditRow[];

  const status = accountStatus(representative);

  const modelNames = new Map(
    models.map((model) => [model.id, model.display_name]),
  );

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
    <main className="min-h-screen bg-[#0b0a0d] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/representatives"
          className="text-sm font-semibold text-pink-300 transition hover:text-pink-200"
        >
          ← Voltar para representantes
        </Link>

        <header className="mt-6 flex flex-col gap-6 rounded-2xl border border-white/10 bg-[#111115] p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
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
              <Info label="Modelos atribuídas" value={`${models.length}`} />
              <Info label="Onboarding médio" value={`${onboardingAverage}%`} />
            </div>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <span
              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${STAFF_STATUS_BADGE[status]}`}
            >
              {STAFF_STATUS_LABELS[status]}
            </span>

            {representative.status_changed_at && (
              <p className="text-xs text-white/40">
                Status alterado em{" "}
                {formatDateTime(representative.status_changed_at)}
              </p>
            )}

            {status === "ativa" ? (
              <Link
                href={`/admin/view-as/representative/${representative.id}`}
                className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-3 text-center text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
              >
                Ver como ele vê
              </Link>
            ) : (
              <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-center text-xs leading-5 text-white/40">
                A visualização como o representante fica disponível apenas para
                contas ativas.
              </p>
            )}

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Modelos
              </p>

              <div className="mt-3">
                <RepresentativeModelsDropdown
                  representativeId={representative.id}
                  models={models}
                />
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#111115] p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            Dados do representante
          </h2>

          <p className="mt-2 text-xs leading-5 text-white/45">
            O nome aparece em cada nota e em cada registro de histórico que esta
            conta cria, e só a equipe pode alterá-lo.
          </p>

          <div className="mt-5 max-w-xl">
            <RepresentativeDetailsForm
              representativeId={representative.id}
              fullName={representative.full_name ?? ""}
              email={representative.email ?? ""}
              phone={representative.phone ?? ""}
            />
          </div>
        </section>

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
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">{model.display_name}</p>

                    <p className="mt-1 text-xs text-white/45">
                      {STATUS_TEXT[
                        normalizeModelStatus(model.status, model.active)
                      ] ?? "—"}{" "}
                      · Onboarding {model.onboarding_percentage ?? 0}%
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
                      Onboarding
                    </Link>

                    <Link
                      href={`/admin/models/${model.slug}`}
                      className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                    >
                      Painel admin
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <h2 className="border-b border-pink-400/20 bg-[#2a1521] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            Notas escritas por este representante ({notes.length})
          </h2>

          {notes.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-white/50">
              Nenhuma nota registrada por esta conta.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {notes.map((note) => (
                <li key={note.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-pink-200">
                      {modelNames.get(note.model_id) ?? "Modelo"}
                    </p>

                    <p className="text-xs text-white/40">
                      {formatDateTime(note.created_at)}
                      {note.deleted_at ? " · excluída" : ""}
                    </p>
                  </div>

                  <p
                    className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${
                      note.deleted_at
                        ? "text-white/35 line-through"
                        : "text-white/80"
                    }`}
                  >
                    {note.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <h2 className="border-b border-pink-400/20 bg-[#2a1521] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            Histórico da conta
          </h2>

          {activity.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-white/50">
              Nenhum registro ainda. Mudanças de status, edições de dados e
              visualizações como este representante aparecem aqui.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {activity.map((entry) => (
                <li key={entry.id} className="px-6 py-4">
                  <p className="text-sm font-semibold">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/50">
                    {entry.summary ??
                      `${entry.actor_name ?? "Sistema"} · ${formatDateTime(entry.created_at)}`}
                  </p>

                  {entry.summary && (
                    <p className="mt-1 text-xs text-white/35">
                      {formatDateTime(entry.created_at)}
                    </p>
                  )}
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
