"use client";

import { useRef, useState } from "react";

import { WHATSAPP_URL } from "@/lib/constants/whatsapp";

import type {
  ModelDashboardChecklist,
  ModelDashboardEarnings,
  ModelDashboardModel,
  ModelDashboardRole,
} from "@/types/modelDashboard";

type ModelDashboardViewProps = {
  viewerRole: ModelDashboardRole;
  model: ModelDashboardModel;
  checklist: ModelDashboardChecklist;
  earnings: ModelDashboardEarnings;
  canEditAvatar: boolean;
};

const RECORDING_GUIDELINES_URL = "/diretrizes-de-gravacao";

export default function ModelDashboardView({
  viewerRole,
  model: initialModel,
  checklist,
  earnings,
  canEditAvatar,
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
        />

        <EarningsCard model={model} earnings={earnings} />

        <StatsRow model={model} />

        <OnboardingChecklist
          steps={checklistSteps}
          checklist={checklist}
          completedCount={completedCount}
          remainingCount={remainingCount}
        />

        <ProfileInfoSection model={model} />

        <ContentSection model={model} viewerRole={viewerRole} />

        <SupportSection />

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
}: {
  model: ModelDashboardModel;
  canEditAvatar: boolean;
  onAvatarUpdated: (url: string) => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 pt-2">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#e8b84b]">
          KARAY MODELS
        </p>

        <h1 className="mt-2 text-2xl font-bold leading-tight">
          Olá, {model.stageName || model.fullName}
        </h1>

        <StatusBadge active={model.active} />
      </div>

      <Avatar
        model={model}
        canEdit={canEditAvatar}
        onAvatarUpdated={onAvatarUpdated}
      />
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
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("modelId", model.id);
      formData.append("file", file);

      const response = await fetch("/api/models/avatar", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        success?: boolean;
        profilePhotoUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.success || !data.profilePhotoUrl) {
        throw new Error(data.error ?? "Não foi possível enviar a foto.");
      }

      onAvatarUpdated(data.profilePhotoUrl);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a foto.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const circle = (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#e8b84b]/40 bg-[#1a1620] text-xl font-bold">
      {model.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={model.profilePhotoUrl}
          alt={model.stageName || model.fullName}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[#e8b84b]">
          {(model.stageName || model.fullName).charAt(0).toUpperCase()}
        </span>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold">
          ...
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
        accept="image/jpeg,image/png,image/webp"
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
  const total = earnings.totalThisMonth || 0;
  const modelAmount = earnings.modelShareAmount || 0;
  const modelPct = earnings.modelPct;
  const agencyPct = earnings.agencyPct;
  const marketingPct = earnings.marketingPct;

  return (
    <section className="rounded-2xl border border-[#e8b84b]/20 bg-gradient-to-b from-[#1a1620] to-[#141019] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
        Seus ganhos este mês
      </p>

      <p className="mt-2 text-3xl font-black text-[#e8b84b]">
        {formatMoney(total, model.preferredCurrency)}
      </p>

      <p className="mt-2 text-sm text-white/60">
        Sua parte ({modelPct}%): {formatMoney(modelAmount, model.preferredCurrency)} ·
        atualizado{" "}
        {earnings.lastUpdated ? formatDate(earnings.lastUpdated) : "—"}
      </p>

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
// Section 3 — Stats row
// ---------------------------------------------------------------------------

function StatsRow({ model }: { model: ModelDashboardModel }) {
  return (
    <section className="grid grid-cols-3 gap-3">
      <StatCard label="Assinantes" value={model.subscribersCount.toLocaleString("pt-BR")} />
      <StatCard label="PPV Vendidos" value={model.ppvSoldCount.toLocaleString("pt-BR")} />
      <StatCard
        label="Gorjetas"
        value={formatMoney(model.tipsAmount, model.preferredCurrency)}
      />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161219] p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-bold text-white">{value}</p>
    </div>
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
    { label: "Moeda preferida", value: showValue(model.preferredCurrency) },
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

function ContentSection({
  model,
  viewerRole,
}: {
  model: ModelDashboardModel;
  viewerRole: ModelDashboardRole;
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
        {model.contentDriveUrl ? (
          <a
            href={model.contentDriveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Abrir pasta no Google Drive
          </a>
        ) : (
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs text-white/45">
            Pasta do Google Drive ainda não configurada. Fale com a agência.
          </p>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !model.contentDriveUrl}
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

      {viewerRole === "representative" && (
        <p className="mt-3 text-[11px] text-white/35">
          Este é o único envio permitido para o representante.
        </p>
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

function formatMoney(amount: number, currency: string | null) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

  const symbol = currencySymbol(currency);

  return `${symbol}${formatted}`;
}

function currencySymbol(currency: string | null) {
  const normalized = (currency || "").trim().toUpperCase();

  if (normalized === "EUR") {
    return "€";
  }

  if (normalized === "BRL" || normalized === "R$") {
    return "R$";
  }

  return "$";
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
