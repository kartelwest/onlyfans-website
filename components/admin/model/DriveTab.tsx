"use client";

import { useState } from "react";

import EditableTextField from "@/components/admin/model/EditableTextField";

import type {
  ManagementRole,
  Model,
} from "@/types/model";

type DriveTabProps = {
  model: Model;
  currentUserRole: ManagementRole;
};

type DriveField =
  | "driveOnlyfans"
  | "driveInstagram"
  | "driveTwitter";

type DriveValues = Record<
  DriveField,
  string
>;

type DriveItem = {
  field: DriveField;
  title: string;
  description: string;
  value: string;
};

type UpdateModelResponse = {
  success?: boolean;
  error?: string;
};

export default function DriveTab({
  model,
  currentUserRole,
}: DriveTabProps) {
  const [isEditing, setIsEditing] =
    useState(false);

  const [driveValues, setDriveValues] =
    useState<DriveValues>({
      driveOnlyfans:
        model.driveOnlyfans ?? "",
      driveInstagram:
        model.driveInstagram ?? "",
      driveTwitter:
        model.driveTwitter ?? "",
    });

  const canEdit =
    currentUserRole === "owner" ||
    currentUserRole === "administrator";

  const driveItems: DriveItem[] = [
    {
      field: "driveOnlyfans",
      title: "OnlyFans",
      description:
        "Pasta destinada ao conteúdo que será publicado ou vendido no OnlyFans.",
      value: driveValues.driveOnlyfans,
    },
    {
      field: "driveInstagram",
      title: "Instagram",
      description:
        "Pasta destinada ao conteúdo de divulgação e crescimento no Instagram.",
      value: driveValues.driveInstagram,
    },
    {
      field: "driveTwitter",
      title: "X / Twitter",
      description:
        "Pasta destinada ao conteúdo de divulgação e crescimento no X / Twitter.",
      value: driveValues.driveTwitter,
    },
  ];

  const configuredFolders =
    driveItems.filter((item) =>
      Boolean(item.value.trim()),
    ).length;

  async function saveDriveField(
    field: DriveField,
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

    const result =
      (await response.json()) as UpdateModelResponse;

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ??
          "Não foi possível salvar a pasta.",
      );
    }

    setDriveValues((current) => ({
      ...current,
      [field]: value.trim(),
    }));
  }

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              Armazenamento
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Google Drive
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              Pastas de conteúdo da modelo para
              OnlyFans, Instagram e X / Twitter.
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                Pastas configuradas
              </p>

              <p className="mt-2 text-2xl font-bold text-pink-300">
                {configuredFolders}
                <span className="text-base text-white/35">
                  {" "}
                  / {driveItems.length}
                </span>
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
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {driveItems.map((item) => (
          <article
            key={item.field}
            className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                  Pasta de conteúdo
                </p>

                <h3 className="mt-2 text-xl font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                  {item.description}
                </p>
              </div>

              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                  item.value.trim()
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : "border-red-400/30 bg-red-500/10 text-red-300"
                }`}
              >
                {item.value.trim()
                  ? "Configurada"
                  : "Não configurada"}
              </span>
            </div>

            <div className="mt-5">
              {isEditing && canEdit ? (
                <EditableTextField
                  label="URL da pasta Google Drive"
                  value={item.value}
                  placeholder="https://drive.google.com/..."
                  inputType="url"
                  onSave={(value) =>
                    saveDriveField(
                      item.field,
                      value,
                    )
                  }
                />
              ) : (
                <DriveInfo
                  value={item.value}
                />
              )}
            </div>

            {item.value.trim() && (
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={normalizeDriveUrl(
                    item.value,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  Abrir pasta
                </a>

                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      item.value,
                    )
                  }
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white/65 transition hover:bg-white/5"
                >
                  Copiar link
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function DriveInfo({
  value,
}: {
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        URL da pasta Google Drive
      </p>

      <p className="mt-3 break-all text-sm text-white">
        {value.trim() || "Não informado"}
      </p>
    </div>
  );
}

function normalizeDriveUrl(
  value: string,
) {
  const trimmedValue = value.trim();

  if (
    trimmedValue.startsWith("http://") ||
    trimmedValue.startsWith("https://")
  ) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}