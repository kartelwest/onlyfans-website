"use client";

import { useTranslations } from "next-intl";

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
  | "contentDriveUrl"
  | "driveInstagram";

type BooleanEditableField = "blockBrazil" | "showFace";

export default function OverviewTab({
  model,
  checklist,
  currentUserRole,
  onModelUpdate,
}: OverviewTabProps) {
  const t = useTranslations("admin.overview");
  const tFields = useTranslations("admin.modelPage.fields");
  const tProfile = useTranslations("dashboard.profile");
  const tContent = useTranslations("dashboard.content");
  const tSocial = useTranslations("admin.social");
  const tChecklist = useTranslations("enums.checklistStatus");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");

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
          tErrors("saveFailed"),
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
      throw new Error(data.error ?? tErrors("saveFailed"));
    }

    onModelUpdate({ ...model, [field]: value });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-300">
          {t("title")}
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
          title={t("onboarding")}
          value={`${checklist.onboardingPercentage}%`}
        />

        <StatusCard
          title="OnlyFans"
          value={
            model.onlyfans
              ? t("configured")
              : tChecklist("not_started")
          }
        />

        <StatusCard
          title="Fansly"
          value={
            model.fansly
              ? t("configured")
              : tChecklist("not_started")
          }
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">
              {t("personalInfo")}
            </h3>

            <p className="mt-1 text-sm text-white/45">
              {t("personalInfoSubtitle")}
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
                  ? "rounded-xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/5"
                  : "rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200"
              }
            >
              {isEditing
                ? tSocial("finishEditing")
                : tCommon("edit")}
            </button>
          )}
        </div>

        {isEditing && canEdit ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <EditableTextField
              label={tFields("fullName")}
              value={model.fullName}
              placeholder={t("placeholders.fullName")}
              onSave={(value) =>
                updateField(
                  "fullName",
                  value,
                )
              }
            />

            <EditableTextField
              label={tFields("stageName")}
              value={model.stageName}
              placeholder={tFields("stageName")}
              onSave={(value) =>
                updateField(
                  "stageName",
                  value,
                )
              }
            />

            <EditableTextField
              label={t("birth")}
              value={model.birthday}
              placeholder={t("placeholders.date")}
              onSave={(value) =>
                updateField(
                  "birthday",
                  value,
                )
              }
            />

            <EditableTextField
              label={tFields("city")}
              value={model.city}
              placeholder={tFields("city")}
              onSave={(value) =>
                updateField(
                  "city",
                  value,
                )
              }
            />

            <EditableTextField
              label={tFields("nationality")}
              value={model.nationality}
              placeholder={tFields("nationality")}
              onSave={(value) =>
                updateField(
                  "nationality",
                  value,
                )
              }
            />

            <EditableTextField
              label={tFields("language")}
              value={model.language}
              placeholder={t("placeholders.language")}
              onSave={(value) =>
                updateField(
                  "language",
                  value,
                )
              }
            />

            <EditableTextField
              label={tFields("email")}
              value={model.email}
              placeholder={t("placeholders.email")}
              inputType="email"
              onSave={(value) =>
                updateField(
                  "email",
                  value,
                )
              }
            />

            <EditableTextField
              label={tFields("whatsapp")}
              value={model.whatsapp}
              placeholder={t("placeholders.whatsapp")}
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
              label={tFields("fullName")}
              value={model.fullName}
            />

            <Info
              label={tFields("stageName")}
              value={model.stageName}
            />

            <Info
              label={t("birth")}
              value={model.birthday}
            />

            <Info
              label={tFields("city")}
              value={model.city}
            />

            <Info
              label={tFields("nationality")}
              value={model.nationality}
            />

            <Info
              label={tFields("language")}
              value={model.language}
            />

            <Info
              label={tFields("email")}
              value={model.email}
            />

            <Info
              label={tFields("whatsapp")}
              value={model.whatsapp}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <div>
          <h3 className="text-xl font-bold">
            {t("dashboardData")}
          </h3>
          <p className="mt-1 text-sm text-white/45">
            {t("dashboardDataSubtitle")}
          </p>
        </div>

        {isEditing && canEdit ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <EditableTextField
              label={tProfile("contentFrequency")}
              value={model.contentFrequency}
              placeholder={t("placeholders.frequency")}
              onSave={(value) => updateField("contentFrequency", value)}
            />

            <EditableTextField
              label={tProfile("referral")}
              value={model.referralSource}
              placeholder={t("placeholders.referral")}
              onSave={(value) => updateField("referralSource", value)}
            />

            {/*
              Both folders the model sees are edited here, and only here. They
              are separate columns — content_drive_url and drive_instagram —
              so neither ever overwrites the other.
            */}
            <EditableTextField
              label={tContent("contentFolderLabel")}
              value={model.contentDriveUrl}
              placeholder="https://drive.google.com/drive/folders/..."
              inputType="url"
              onSave={(value) => updateField("contentDriveUrl", value)}
            />

            <EditableTextField
              label={tContent("instagramFolderLabel")}
              value={model.driveInstagram}
              placeholder="https://drive.google.com/drive/folders/..."
              inputType="url"
              onSave={(value) => updateField("driveInstagram", value)}
            />

            <BooleanToggle
              label={tProfile("blockBrazil")}
              value={model.blockBrazil}
              onChange={(value) => updateBooleanField("blockBrazil", value)}
            />

            <BooleanToggle
              label={tProfile("showFace")}
              value={model.showFace}
              onChange={(value) => updateBooleanField("showFace", value)}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Info label={tProfile("contentFrequency")} value={model.contentFrequency} />
            <Info label={tProfile("referral")} value={model.referralSource} />
            <Info
              label={tContent("contentFolderLabel")}
              value={model.contentDriveUrl}
            />
            <Info
              label={tContent("instagramFolderLabel")}
              value={model.driveInstagram}
            />
            <Info
              label={tProfile("blockBrazil")}
              value={model.blockBrazil ? tState("yes") : tState("no")}
            />
            <Info
              label={tProfile("showFace")}
              value={model.showFace ? tState("yes") : tState("no")}
            />
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
  const tState = useTranslations("common.states");

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
          {tState("yes")}
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
          {tState("no")}
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
  const tState = useTranslations("common.states");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>

      <p className="mt-3 text-sm text-white">
        {value || tState("notInformed")}
      </p>
    </div>
  );
}