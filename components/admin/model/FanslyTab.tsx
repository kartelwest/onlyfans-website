"use client";

import { useState } from "react";

import EditableTextField from "@/components/admin/model/EditableTextField";
import ModelEarningsPanel from "@/components/admin/model/ModelEarningsPanel";

import type {
  ManagementRole,
  Model,
} from "@/types/model";

type FanslyTabProps = {
  model: Model;
  currentUserRole: ManagementRole;
};

type UpdateModelResponse = {
  success?: boolean;
  error?: string;
};

export default function FanslyTab({
  model,
  currentUserRole,
}: FanslyTabProps) {
  const [isEditing, setIsEditing] =
    useState(false);

  const [fansly, setFansly] = useState(
    model.fansly ?? "",
  );

  const canEdit =
    currentUserRole === "owner" ||
    currentUserRole === "administrator";

  async function saveFansly(
    value: string,
  ) {
    const response = await fetch(
      "/api/models/update",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          modelId: model.id,
          field: "fansly",
          value,
        }),
      },
    );

    const result =
      (await response.json()) as UpdateModelResponse;

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ??
          "Não foi possível salvar.",
      );
    }

    setFansly(value.trim());
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              Conta administrada
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Fansly
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              Informações da conta Fansly,
              situação de cadastro e acesso
              direto à plataforma.
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() =>
                setIsEditing(
                  (current) => !current,
                )
              }
              className={
                isEditing
                  ? "rounded-xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
                  : "rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200"
              }
            >
              {isEditing
                ? "Concluir edição"
                : "Editar"}
            </button>
          )}
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
            value={
              model.active
                ? "Ativa"
                : "Inativa"
            }
            status={
              model.active
                ? "success"
                : "neutral"
            }
          />

          <InfoCard
            label="Onboarding"
            value={`${
              model.onboardingPercentage ??
              0
            }%`}
          />
        </div>

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            Conta Fansly
          </p>

          <div className="mt-4">
            {isEditing && canEdit ? (
              <EditableTextField
                label="Usuário ou URL da conta"
                value={fansly}
                placeholder="@usuario ou https://fansly.com/usuario"
                inputType="text"
                onSave={saveFansly}
              />
            ) : fansly ? (
              <>
                <p className="break-all text-sm font-medium text-white">
                  {fansly}
                </p>

                <a
                  href={normalizeFanslyUrl(
                    fansly,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-xl border border-pink-400/30 bg-pink-500/10 px-4 py-2.5 text-sm font-bold text-pink-200 transition hover:bg-pink-500/20"
                >
                  Abrir Fansly
                </a>
              </>
            ) : (
              <p className="text-sm text-red-300">
                Conta Fansly ainda não
                cadastrada.
              </p>
            )}
          </div>
        </section>
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
  value:
    | string
    | number
    | null
    | undefined;
  status?:
    | "default"
    | "success"
    | "neutral";
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
  value:
    | string
    | number
    | null
    | undefined,
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

function normalizeFanslyUrl(
  value: string,
) {
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (value.startsWith("@")) {
    return `https://fansly.com/${value.slice(
      1,
    )}`;
  }

  return `https://fansly.com/${value}`;
}