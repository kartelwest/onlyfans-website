"use client";

import { useRef, useState, type ReactNode } from "react";

import LogoutButton from "@/components/LogoutButton";
import { WHATSAPP_URL } from "@/lib/constants/whatsapp";
import { countryCodeToFlag } from "@/lib/countries";
import { formatDatePtBr } from "@/lib/earnings/period";
import { describeLedgerEntry } from "@/lib/ledger/entries";
import {
  AVATAR_ACCEPT_ATTRIBUTE,
  uploadModelAvatar,
  validateAvatarFile,
} from "@/lib/models/avatarUpload";
import { BRL, USD, formatFxRate, formatMoney } from "@/lib/money/currency";

import type { LedgerEntry } from "@/types/ledger";
import type {
  ModelDashboardChecklist,
  ModelDashboardEarnings,
  ModelDashboardLedger,
  ModelDashboardModel,
  ModelDashboardRole,
} from "@/types/modelDashboard";

type ModelDashboardViewProps = {
  viewerRole: ModelDashboardRole;
  model: ModelDashboardModel;
  checklist: ModelDashboardChecklist;
  earnings: ModelDashboardEarnings;
  /** Null when the model is not on the expenses/loans feature. */
  ledger: ModelDashboardLedger | null;
  canEditAvatar: boolean;
  /**
   * An admin looking at this screen as somebody else. Everything reads the
   * same, but nothing acts: no signing the admin out of her own account from
   * inside a model's page, and no uploading to the model's Drive by accident.
   */
  previewMode?: boolean;
  /** Extra section rendered before the footer; used by the representative notes panel. */
  children?: ReactNode;
};

const RECORDING_GUIDELINES_URL = "/diretrizes-de-gravacao";

export default function ModelDashboardView({
  viewerRole,
  model: initialModel,
  checklist,
  earnings,
  ledger,
  canEditAvatar,
  previewMode = false,
  children,
}: ModelDashboardViewProps) {
  const [model, setModel] = useState(initialModel);

  const checklistSteps: {
    key: keyof ModelDashboardChecklist;
    label: string;
  }[] = [
    { key: "applicationApproved", label: "Candidatura aprovada" },
    { key: "onlyfansAccountCreated", label: "Conta OnlyFans criada" },
    { key: "socialAccountsConfigured", label: "Redes sociais configuradas" },
    { key: "proxyBrowserReady", label: "Proxy e navegador dedicados" },
    { key: "firstContentReceived", label: "Primeiro conteúdo recebido" },
    { key: "contractSigned", label: "Contrato assinado" },
  ];

  const completedCount = checklistSteps.filter(
    (step) => checklist[step.key],
  ).length;
  const remainingCount = checklistSteps.length - completedCount;

  return (
    <main className="min-h-screen bg-[#0b0a0d] pb-16 text-white">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 sm:max-w-lg">
        <Header
          model={model}
          onAvatarUpdated={(url) =>
            setModel((current) => ({ ...current, profilePhotoUrl: url }))
          }
          canEditAvatar={canEditAvatar}
          viewerRole={viewerRole}
          previewMode={previewMode}
        />

        <EarningsCard model={model} earnings={earnings} />

        {ledger && (
          <>
            <ExpensesSection ledger={ledger} />
            <LoansSection ledger={ledger} />
            <LedgerNotesSection ledger={ledger} />
          </>
        )}

        <OnboardingChecklist
          steps={checklistSteps}
          checklist={checklist}
          completedCount={completedCount}
          remainingCount={remainingCount}
        />

        <ProfileInfoSection model={model} />

        <ContentSection
          model={model}
          viewerRole={viewerRole}
          previewMode={previewMode}
        />

        <SupportSection />

        {children}

        <Footer />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Header
// ---------------------------------------------------------------------------

function Header({
  model,
  canEditAvatar,
  onAvatarUpdated,
  viewerRole,
  previewMode,
}: {
  model: ModelDashboardModel;
  canEditAvatar: boolean;
  onAvatarUpdated: (url: string) => void;
  viewerRole: ModelDashboardRole;
  previewMode: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pt-2">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#e8b84b]">
          KARAY MODELS
        </p>

        <h1 className="mt-2 text-2xl font-bold leading-tight">
          Olá, {model.stageName || model.fullName}
        </h1>

        <StatusBadge active={model.active} />
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3">
        <Avatar
          model={model}
          canEdit={canEditAvatar}
          onAvatarUpdated={onAvatarUpdated}
        />

        {/*
          Models are on phones, so this sits in the normal flow at the top of
          the page — always visible, tappable, never behind a hover menu.
          Hidden for a representative, who reaches this same view through
          /representative/models/[id], and for an admin previewing the page:
          signing them out of their own account from inside a model's page
          would be a nasty surprise.
        */}
        {viewerRole === "model" && !previewMode && (
          <LogoutButton className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60" />
        )}
      </div>
    </header>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <div
      className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-400/30 bg-red-500/10 text-red-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-red-400"}`}
      />
      {active ? "Modelo ativa" : "Modelo inativa"}
    </div>
  );
}

function Avatar({
  model,
  canEdit,
  onAvatarUpdated,
}: {
  model: ModelDashboardModel;
  canEdit: boolean;
  onAvatarUpdated: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError(null);

    // Same limits the admin editor and the server apply — checked here so a
    // model on mobile data is told before the upload, not after it.
    const validation = validateAvatarFile(file);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setProgress(0);
    setIsUploading(true);

    try {
      const url = await uploadModelAvatar({
        modelId: model.id,
        file,
        onProgress: setProgress,
      });

      onAvatarUpdated(url);
    } catch (uploadError) {
      setPreview(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a foto.",
      );
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  const circle = (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#e8b84b]/40 bg-[#1a1620] text-xl font-bold">
      {preview ?? model.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview ?? model.profilePhotoUrl ?? ""}
          alt={model.stageName || model.fullName}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[#e8b84b]">
          {(model.stageName || model.fullName).charAt(0).toUpperCase()}
        </span>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold">
          {progress}%
        </div>
      )}
    </div>
  );

  if (!canEdit) {
    return circle;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="disabled:opacity-60"
        aria-label="Alterar foto de perfil"
      >
        {circle}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={AVATAR_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />

      <span className="text-[10px] font-semibold text-[#e8b84b]">
        Editar
      </span>

      {error && (
        <span className="max-w-[90px] text-center text-[9px] text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Earnings card
// ---------------------------------------------------------------------------

function EarningsCard({
  model,
  earnings,
}: {
  model: ModelDashboardModel;
  earnings: ModelDashboardEarnings;
}) {
  const [showDeductions, setShowDeductions] = useState(false);

  const modelPct = earnings.modelPct;
  const agencyPct = earnings.agencyPct;
  const marketingPct = earnings.marketingPct;

  const flag = model.countryCode ? countryCodeToFlag(model.countryCode) : "";
  const rate = earnings.displayRate;

  // A model paid in USD has nothing to convert; everyone else sees her own
  // currency next to the USD figure the agency reports in.
  const converts = model.currency !== USD && rate !== null;

  const inCurrency = (amountUsd: number) =>
    rate ? amountUsd * rate.rate : null;

  const withFlag = (text: string) => (flag ? `${flag} ${text}` : text);

  return (
    <section className="rounded-2xl border border-[#e8b84b]/20 bg-gradient-to-b from-[#1a1620] to-[#141019] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        Seus ganhos de {earnings.periodTitle}
      </p>

      {earnings.published ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-3xl font-black text-[#e8b84b]">
          <span>
            {converts
              ? formatMoney(earnings.grossUsd, USD, { withCode: true })
              : withFlag(formatMoney(earnings.grossUsd, USD, { withCode: true }))}
          </span>

          {converts && (
            <span className="text-xl text-white/70">
              ·{" "}
              {withFlag(
                formatMoney(inCurrency(earnings.grossUsd) ?? 0, model.currency),
              )}
            </span>
          )}
        </p>
      ) : (
        <>
          <p className="mt-2 text-3xl font-black text-[#e8b84b]">—</p>

          <p className="mt-1 text-sm text-white/55">
            Aguardando atualização da agência.
          </p>
        </>
      )}

      {earnings.published && (
        <div className="mt-3 space-y-1.5 text-sm text-white/70">
          <p>
            Sua parte ({modelPct}%):{" "}
            <span className="font-semibold text-white">
              {formatMoney(earnings.modelShareUsd, USD, { withCode: true })}
            </span>
          </p>

          {earnings.deductionsUsd > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowDeductions((current) => !current)}
                className="flex w-full items-center gap-1.5 text-left"
                aria-expanded={showDeductions}
              >
                <span>
                  Descontos de {earnings.periodMonthName}:{" "}
                  <span className="font-semibold text-red-300">
                    {formatMoney(earnings.deductionsUsd, USD, {
                      withCode: true,
                      negative: true,
                    })}
                  </span>{" "}
                  <span className="text-white/45">
                    ({formatMoney(earnings.deductionsBrl, BRL)})
                  </span>
                </span>

                <span className="text-[10px] text-white/40">
                  {showDeductions ? "▲" : "▼"}
                </span>
              </button>

              {showDeductions && (
                <ul className="mt-2 space-y-1 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/60">
                  {earnings.deductions.map((deduction) => (
                    <li
                      key={deduction.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <span>
                        {deduction.label}
                        <span className="block text-[10px] text-white/35">
                          {formatDatePtBr(deduction.deductOn)}
                        </span>
                      </span>

                      <span className="whitespace-nowrap text-right">
                        {formatMoney(deduction.amountUsd, USD, {
                          negative: true,
                        })}
                        <span className="block text-[10px] text-white/35">
                          {formatMoney(deduction.amountBrl, BRL)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="flex flex-wrap items-baseline gap-x-2">
            <span>
              A receber:{" "}
              <span className="font-semibold text-white">
                {formatMoney(earnings.payableUsd, USD, { withCode: true })}
              </span>
            </span>

            {converts && (
              <span className="text-white/55">
                ·{" "}
                {withFlag(
                  formatMoney(
                    inCurrency(earnings.payableUsd) ?? 0,
                    model.currency,
                  ),
                )}
              </span>
            )}
          </p>

          {earnings.remainingUsd > 0 && (
            <p className="text-red-300">
              Saldo a descontar:{" "}
              <span className="font-semibold">
                {formatMoney(earnings.remainingUsd, USD, { withCode: true })}
              </span>
            </p>
          )}
        </div>
      )}

      {converts && rate && (
        <p className="mt-3 text-[11px] text-white/40">
          Câmbio de {formatDatePtBr(rate.rateDate)}:{" "}
          {formatFxRate(rate.rate, USD, model.currency)}
        </p>
      )}

      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full bg-[#e8b84b]"
            style={{ width: `${Math.min(Math.max(modelPct, 0), 100)}%` }}
          />
          <div
            className="h-full bg-[#8a3ffc]/70"
            style={{ width: `${Math.min(Math.max(agencyPct, 0), 100)}%` }}
          />
          <div
            className="h-full bg-red-500/70"
            style={{ width: `${Math.min(Math.max(marketingPct, 0), 100)}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-white/60">
          <LegendDot color="bg-[#e8b84b]" label={`Você ${modelPct}%`} />
          <LegendDot color="bg-[#8a3ffc]/70" label={`Agência ${agencyPct}%`} />
          <LegendDot
            color="bg-red-500/70"
            label={`Marketing ${marketingPct}%`}
          />
        </div>
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Despesas / Empréstimos / Notas (ledger, read-only)
//
// Rendered only when the agency has the expenses feature on for this model:
// the parent gets `ledger = null` otherwise, so these sections are absent from
// the payload as well as from the DOM.
// ---------------------------------------------------------------------------

function ExpensesSection({ ledger }: { ledger: ModelDashboardLedger }) {
  return (
    <LedgerSection
      title="Despesas"
      emptyLabel="Nenhuma despesa registrada."
      entries={ledger.expenses}
      totalLabel="Total"
      total={ledger.expensesTotalBrl}
    />
  );
}

function LoansSection({ ledger }: { ledger: ModelDashboardLedger }) {
  return (
    <LedgerSection
      title="Empréstimos"
      emptyLabel="Nenhum empréstimo registrado."
      entries={ledger.loans}
      totalLabel="Em aberto"
      total={ledger.loansOutstandingBrl}
    />
  );
}

function LedgerSection({
  title,
  emptyLabel,
  entries,
  totalLabel,
  total,
}: {
  title: string;
  emptyLabel: string;
  entries: LedgerEntry[];
  totalLabel: string;
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#161219] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        {title}
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">{emptyLabel}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {describeLedgerEntry(entry)}
                  </p>

                  <p className="mt-0.5 text-[11px] text-white/40">
                    {formatDatePtBr(entry.incurredOn)}
                  </p>

                  <LedgerStatusBadge entry={entry} />
                </div>

                <p className="whitespace-nowrap text-sm font-semibold text-white">
                  {formatMoney(entry.amountBrl, BRL)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-white/55">{totalLabel}</span>

            <span className="font-bold text-white">
              {formatMoney(total, BRL)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function LedgerStatusBadge({ entry }: { entry: LedgerEntry }) {
  const styles: Record<string, string> = {
    pendente: "border-white/15 bg-white/5 text-white/55",
    agendado: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
    descontado: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span
      className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
        styles[entry.status.kind]
      }`}
    >
      {entry.status.label}
    </span>
  );
}

function LedgerNotesSection({ ledger }: { ledger: ModelDashboardLedger }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#161219] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        Notas
      </p>

      {ledger.notes.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">Nenhuma nota registrada.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {ledger.notes.map((note) => (
            <li
              key={note.id}
              className="border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
            >
              <p className="text-sm text-white/80">{note.body}</p>

              <p className="mt-1 text-[11px] text-white/35">
                {formatDate(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Onboarding checklist
// ---------------------------------------------------------------------------

function OnboardingChecklist({
  steps,
  checklist,
  completedCount,
  remainingCount,
}: {
  steps: { key: keyof ModelDashboardChecklist; label: string }[];
  checklist: ModelDashboardChecklist;
  completedCount: number;
  remainingCount: number;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#161219] p-5">
      <p className="text-sm font-bold text-white">
        Seu onboarding {completedCount} de {steps.length}
      </p>

      <ul className="mt-4 space-y-3">
        {steps.map((step) => {
          const done = checklist[step.key];

          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  done
                    ? "bg-[#e8b84b] text-[#1a1620]"
                    : "border border-white/25 text-transparent"
                }`}
              >
                {done ? "✓" : "•"}
              </span>

              <span
                className={`text-sm ${done ? "text-white" : "text-white/55"}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {remainingCount > 0 && (
        <p className="mt-4 text-xs text-white/45">
          Faltam {remainingCount}{" "}
          {remainingCount === 1 ? "etapa" : "etapas"} para concluir seu
          onboarding.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — Seus Dados (read-only)
// ---------------------------------------------------------------------------

function ProfileInfoSection({ model }: { model: ModelDashboardModel }) {
  const fields: { label: string; value: string }[] = [
    { label: "Nome completo", value: showValue(model.fullName) },
    { label: "Nome artístico", value: showValue(model.stageName) },
    { label: "Data de nascimento", value: formatDate(model.birthday) },
    { label: "Localização", value: showValue(model.location) },
    { label: "E-mail", value: showValue(model.email) },
    { label: "WhatsApp", value: showValue(model.whatsapp) },
    { label: "Moeda", value: model.currency },
    {
      label: "Frequência de conteúdo",
      value: showValue(model.contentFrequency),
    },
    { label: "Bloquear Brasil", value: model.blockBrazil ? "Sim" : "Não" },
    { label: "Mostrar rosto", value: model.showFace ? "Sim" : "Não" },
    { label: "Indicação", value: showValue(model.referralSource) },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-[#161219] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        Seus dados
      </p>

      <dl className="mt-4 space-y-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
          >
            <dt className="text-sm text-white/55">{field.label}</dt>
            <dd className="text-right text-sm font-semibold text-white">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 7 — Enviar conteúdo
// ---------------------------------------------------------------------------

/**
 * One agency-assigned Drive folder, read-only.
 *
 * The label is always shown, whether or not a folder has been assigned, so an
 * unassigned folder reads as "not set up yet" instead of simply being absent —
 * and so the two folders can never be confused for one another.
 */
function DriveFolderLink({
  label,
  description,
  url,
}: {
  label: string;
  description: string;
  url: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">
        {label}
      </p>

      <p className="mt-1 text-[11px] text-white/40">{description}</p>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Abrir pasta no Google Drive
        </a>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-3 text-center text-xs text-white/45">
          Pasta ainda não configurada. Fale com a agência.
        </p>
      )}
    </div>
  );
}

function ContentSection({
  model,
  viewerRole,
  previewMode,
}: {
  model: ModelDashboardModel;
  viewerRole: ModelDashboardRole;
  previewMode: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFilesSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setStatus(`Enviando 0/${files.length}...`);

    let sent = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("modelId", model.id);
        formData.append("file", file);

        const response = await fetch("/api/models/drive-upload", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as {
          success?: boolean;
          error?: string;
        };

        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "Falha no envio.");
        }

        sent += 1;
      } catch (uploadError) {
        failed += 1;
        setErrorMessage(
          uploadError instanceof Error
            ? uploadError.message
            : "Falha ao enviar um dos arquivos.",
        );
      }

      setStatus(`Enviando ${sent + failed}/${files.length}...`);
    }

    setIsUploading(false);
    setStatus(
      failed === 0
        ? `${sent} arquivo(s) enviado(s) com sucesso.`
        : `${sent} enviado(s), ${failed} com falha.`,
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#161219] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        Enviar conteúdo
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {/*
          Two folders, two purposes, and they must never be mistaken for each
          other: the content folder is where her material goes, the Instagram
          one is for her Instagram material. Both are set by the agency — there
          is no editor here, and /api/models/update refuses anyone who is not
          an owner or an administrator.
        */}
        <DriveFolderLink
          label="Google Drive / Conteúdo"
          description="Onde o seu conteúdo é enviado."
          url={model.contentDriveUrl}
        />

        <DriveFolderLink
          label="Google Drive / Instagram"
          description="Material do seu Instagram."
          url={model.driveInstagramUrl}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={previewMode || isUploading || !model.contentDriveUrl}
          className="flex items-center justify-center rounded-xl bg-[#e8b84b] px-4 py-3 text-sm font-black uppercase tracking-[0.06em] text-[#1a1620] transition hover:bg-[#f2c869] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isUploading ? "Enviando..." : "Enviar conteúdo para o Drive"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFilesSelected(event)}
        />

        {status && (
          <p className="text-center text-xs text-white/55">{status}</p>
        )}

        {errorMessage && (
          <p className="text-center text-xs text-red-300">{errorMessage}</p>
        )}

        <a
          href={RECORDING_GUIDELINES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/5"
        >
          Ver diretrizes de gravação
        </a>
      </div>

      {previewMode ? (
        <p className="mt-3 text-[11px] text-white/35">
          O envio de conteúdo fica desativado no modo de visualização.
        </p>
      ) : (
        viewerRole === "representative" && (
          <p className="mt-3 text-[11px] text-white/35">
            Este é o único envio permitido para o representante.
          </p>
        )
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 8 — Suporte
// ---------------------------------------------------------------------------

function SupportSection() {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#161219] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        Suporte
      </p>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center rounded-xl bg-emerald-500/90 px-4 py-3 text-sm font-black uppercase tracking-[0.06em] text-[#0b0a0d] transition hover:bg-emerald-400"
      >
        Falar com a equipe no WhatsApp
      </a>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 9 — Footer
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer className="pb-4 pt-2 text-center text-[11px] text-white/30">
      KARAY Models · Área da Modelo
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showValue(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return "Não definido";
  }

  return value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
