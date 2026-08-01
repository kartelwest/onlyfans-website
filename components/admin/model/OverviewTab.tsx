"use client";

import { useState } from "react";

import EditableTextField from "@/components/admin/model/EditableTextField";
import FinancialSettingsSection from "@/components/admin/model/FinancialSettingsSection";
import SocialAccountsSection from "@/components/admin/model/SocialAccountsSection";

import type {
  ManagementRole,
  Model,
  ModelChecklist,
} from "@/types/model";

type OverviewTabProps = {
  model: Model;
  checklist: ModelChecklist;
  currentUserRole: ManagementRole;
  onModelUpdate: (updatedModel: Model) => void;
};

type EditableField =
  | "fullName"
  | "stageName"
  | "birthday"
  | "city"
  | "nationality"
  | "language"
  | "email"
  | "whatsapp"
  | "preferredCurrency"
  | "contentFrequency"
  | "referralSource"
  | "contentDriveUrl";

type BooleanEditableField = "blockBrazil" | "showFace";

export default function OverviewTab({
  model,
  checklist,
  currentUserRole,
  onModelUpdate,
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
    if (field === "fullName" && !value.trim()) {
      return;
    }

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

    onModelUpdate({
      ...model,
      [field]: value,
      ...(field === "fullName" && { displayName: value }),
    });
  }

  async function updateBooleanField(
    field: BooleanEditableField,
    value: boolean,
  ) {
    const response = await fetch("/api/models/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: model.id,
        field,
        value: value ? "true" : "false",
      }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Não foi possível salvar.");
    }

    onModelUpdate({ ...model, [field]: value });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-300">
          Resumo
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {model.fullName}
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

      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <div>
          <h3 className="text-xl font-bold">
            Dados do Model Dashboard
          </h3>
          <p className="mt-1 text-sm text-white/45">
            Campos exibidos na Área da Modelo / visão do representante.
          </p>
        </div>

        {isEditing && canEdit ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <EditableTextField
              label="Frequência de conteúdo"
              value={model.contentFrequency}
              placeholder="Diária, semanal..."
              onSave={(value) => updateField("contentFrequency", value)}
            />

            <EditableTextField
              label="Indicação"
              value={model.referralSource}
              placeholder="Como conheceu a agência"
              onSave={(value) => updateField("referralSource", value)}
            />

            <EditableTextField
              label="Pasta do Google Drive (conteúdo)"
              value={model.contentDriveUrl}
              placeholder="https://drive.google.com/drive/folders/..."
              inputType="url"
              onSave={(value) => updateField("contentDriveUrl", value)}
            />

            <BooleanToggle
              label="Bloquear Brasil"
              value={model.blockBrazil}
              onChange={(value) => updateBooleanField("blockBrazil", value)}
            />

            <BooleanToggle
              label="Mostrar rosto"
              value={model.showFace}
              onChange={(value) => updateBooleanField("showFace", value)}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Info label="Frequência de conteúdo" value={model.contentFrequency} />
            <Info label="Indicação" value={model.referralSource} />
            <Info
              label="Pasta do Google Drive (conteúdo)"
              value={model.contentDriveUrl}
            />
            <Info
              label="Bloquear Brasil"
              value={model.blockBrazil ? "Sim" : "Não"}
            />
            <Info label="Mostrar rosto" value={model.showFace ? "Sim" : "Não"} />
          </div>
        )}
      </section>

      {canEdit && (
        <FinancialSettingsSection
          model={model}
          onModelUpdate={onModelUpdate}
        />
      )}

      {canEdit && (
        <SocialAccountsSection
          model={model}
          onModelUpdate={onModelUpdate}
        />
      )}
    </div>
  );
}

function BooleanToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
            value
              ? "bg-pink-300 text-[#321725]"
              : "border border-white/15 text-white/60 hover:bg-white/5"
          }`}
        >
          Sim
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
            !value
              ? "bg-pink-300 text-[#321725]"
              : "border border-white/15 text-white/60 hover:bg-white/5"
          }`}
        >
          Não
        </button>
      </div>
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