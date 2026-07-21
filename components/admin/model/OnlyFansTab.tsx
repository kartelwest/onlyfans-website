"use client";

import ModelEarningsPanel from "@/components/admin/model/ModelEarningsPanel";

import type {
  ManagementRole,
  Model,
} from "@/types/model";

type OnlyFansTabProps = {
  model: Model;
  currentUserRole: ManagementRole;
};

export default function OnlyFansTab({
  model,
  currentUserRole,
}: OnlyFansTabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
            Conta administrada
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            OnlyFans
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Informações da conta OnlyFans, situação de
            cadastro e acesso direto à plataforma.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Modelo"
            value={model.displayName}
          />

          <InfoCard
            label="Nome artístico"
            value={model.stageName}
          />

          <InfoCard
            label="Status da modelo"
            value={model.active ? "Ativa" : "Inativa"}
            status={model.active ? "success" : "neutral"}
          />

          <InfoCard
            label="Onboarding"
            value={`${model.onboardingPercentage ?? 0}%`}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Conta OnlyFans
            </p>

            <div className="mt-4">
              {model.onlyfans ? (
                <>
                  <p className="break-all text-sm font-medium text-white">
                    {model.onlyfans}
                  </p>

                  <a
                    href={normalizeExternalUrl(model.onlyfans)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-xl border border-pink-400/30 bg-pink-500/10 px-4 py-2.5 text-sm font-bold text-pink-200 transition hover:bg-pink-500/20"
                  >
                    Abrir OnlyFans
                  </a>
                </>
              ) : (
                <p className="text-sm text-red-300">
                  Conta OnlyFans ainda não cadastrada.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Pasta de conteúdo
            </p>

            <div className="mt-4">
              {model.driveOnlyfans ? (
                <>
                  <p className="text-sm leading-6 text-white/60">
                    A pasta do Google Drive está configurada
                    para receber o conteúdo da modelo.
                  </p>

                  <a
                    href={model.driveOnlyfans}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Abrir pasta OnlyFans
                  </a>
                </>
              ) : (
                <p className="text-sm text-red-300">
                  Pasta OnlyFans ainda não configurada.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      <ModelEarningsPanel
        modelId={model.id}
        modelName={model.displayName}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
  status = "default",
}: {
  label: string;
  value: string | number | null | undefined;
  status?: "default" | "success" | "neutral";
}) {
  const styles = {
    default:
      "border-white/10 bg-white/[0.03] text-white",
    success:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    neutral:
      "border-white/10 bg-white/[0.03] text-white/55",
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${styles[status]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-55">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-bold">
        {showValue(value)}
      </p>
    </div>
  );
}

function showValue(
  value: string | number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Não informado";
  }

  return value;
}

function normalizeExternalUrl(value: string) {
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (value.startsWith("@")) {
    return `https://onlyfans.com/${value.slice(1)}`;
  }

  return `https://onlyfans.com/${value}`;
}