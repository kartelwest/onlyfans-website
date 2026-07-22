"use client";

import { useState } from "react";

import EditableTextField from "@/components/admin/model/EditableTextField";

import type {
  ManagementRole,
  Model,
  ModelChecklist,
} from "@/types/model";

type OverviewTabProps = {
  model: Model;
  checklist: ModelChecklist;
  currentUserRole: ManagementRole;
};

type EditableField =
  | "fullName"
  | "stageName"
  | "birthday"
  | "city"
  | "nationality"
  | "language"
  | "email"
  | "whatsapp";

export default function OverviewTab({
  model,
  checklist,
  currentUserRole,
}: OverviewTabProps) {
  const [isEditing, setIsEditing] =
    useState(false);

  const canEdit =
    currentUserRole === "owner" ||
    currentUserRole === "administrator";

  async function updateField(
    field: EditableField,
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
          field,
          value,
        }),
      },
    );

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ??
          "Não foi possível salvar.",
      );
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-300">
          Resumo
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {model.displayName}
        </h2>

        <p className="mt-1 text-white/60">
          Modelo #{model.modelNumber ?? "--"}
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <StatusCard
          title="Onboarding"
          value={`${checklist.onboardingPercentage}%`}
        />

        <StatusCard
          title="OnlyFans"
          value={
            model.onlyfans
              ? "Configurado"
              : "Não iniciado"
          }
        />

        <StatusCard
          title="Fansly"
          value={
            model.fansly
              ? "Configurado"
              : "Não iniciado"
          }
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">
              Informações pessoais
            </h3>

            <p className="mt-1 text-sm text-white/45">
              Dados pessoais e informações de contato.
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

        {isEditing && canEdit ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <EditableTextField
              label="Nome completo"
              value={model.fullName}
              placeholder="Nome completo da modelo"
              onSave={(value) =>
                updateField(
                  "fullName",
                  value,
                )
              }
            />

            <EditableTextField
              label="Nome artístico"
              value={model.stageName}
              placeholder="Nome artístico"
              onSave={(value) =>
                updateField(
                  "stageName",
                  value,
                )
              }
            />

            <EditableTextField
              label="Nascimento"
              value={model.birthday}
              placeholder="AAAA-MM-DD"
              onSave={(value) =>
                updateField(
                  "birthday",
                  value,
                )
              }
            />

            <EditableTextField
              label="Cidade"
              value={model.city}
              placeholder="Cidade"
              onSave={(value) =>
                updateField(
                  "city",
                  value,
                )
              }
            />

            <EditableTextField
              label="Nacionalidade"
              value={model.nationality}
              placeholder="Nacionalidade"
              onSave={(value) =>
                updateField(
                  "nationality",
                  value,
                )
              }
            />

            <EditableTextField
              label="Idioma"
              value={model.language}
              placeholder="Idioma principal"
              onSave={(value) =>
                updateField(
                  "language",
                  value,
                )
              }
            />

            <EditableTextField
              label="E-mail"
              value={model.email}
              placeholder="email@exemplo.com"
              inputType="email"
              onSave={(value) =>
                updateField(
                  "email",
                  value,
                )
              }
            />

            <EditableTextField
              label="WhatsApp"
              value={model.whatsapp}
              placeholder="+55..."
              inputType="tel"
              onSave={(value) =>
                updateField(
                  "whatsapp",
                  value,
                )
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Info
              label="Nome completo"
              value={model.fullName}
            />

            <Info
              label="Nome artístico"
              value={model.stageName}
            />

            <Info
              label="Nascimento"
              value={model.birthday}
            />

            <Info
              label="Cidade"
              value={model.city}
            />

            <Info
              label="Nacionalidade"
              value={model.nationality}
            />

            <Info
              label="Idioma"
              value={model.language}
            />

            <Info
              label="E-mail"
              value={model.email}
            />

            <Info
              label="WhatsApp"
              value={model.whatsapp}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function StatusCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-pink-400/20 bg-[#18181d] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-300">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>

      <p className="mt-3 text-sm text-white">
        {value || "Não informado"}
      </p>
    </div>
  );
}