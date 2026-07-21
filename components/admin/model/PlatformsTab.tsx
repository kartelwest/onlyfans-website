"use client";

import {
  useMemo,
  useState,
} from "react";

import EditableTextField from "@/components/admin/model/EditableTextField";

import type {
  ManagementRole,
  Model,
} from "@/types/model";

type PlatformsTabProps = {
  model: Model;
  currentUserRole: ManagementRole;
};

type EditableModelField =
  | "instagram"
  | "twitter"
  | "reddit"
  | "tiktok"
  | "youtube"
  | "facebook";

type PlatformValues = Record<
  EditableModelField,
  string
>;

type PlatformItem = {
  field: EditableModelField;
  name: string;
  value: string;
  placeholder: string;
  description: string;
};

type UpdateModelResponse = {
  success?: boolean;
  error?: string;
};

export default function PlatformsTab({
  model,
  currentUserRole,
}: PlatformsTabProps) {
  const [isEditing, setIsEditing] =
    useState(false);

  const [platformValues, setPlatformValues] =
    useState<PlatformValues>({
      instagram: model.instagram ?? "",
      twitter: model.twitter ?? "",
      reddit: model.reddit ?? "",
      tiktok: model.tiktok ?? "",
      youtube: model.youtube ?? "",
      facebook: model.facebook ?? "",
    });

  const canEdit =
    currentUserRole === "owner" ||
    currentUserRole === "administrator";

  const platforms: PlatformItem[] = useMemo(
    () => [
      {
        field: "instagram",
        name: "Instagram",
        value: platformValues.instagram,
        placeholder:
          "@usuario ou https://instagram.com/usuario",
        description:
          "Conta principal para divulgação e construção da marca.",
      },
      {
        field: "twitter",
        name: "X / Twitter",
        value: platformValues.twitter,
        placeholder:
          "@usuario ou https://x.com/usuario",
        description:
          "Conta para divulgação, crescimento e aquisição de assinantes.",
      },
      {
        field: "reddit",
        name: "Reddit",
        value: platformValues.reddit,
        placeholder:
          "usuario ou https://reddit.com/user/usuario",
        description:
          "Conta utilizada para comunidades, postagens e tráfego.",
      },
      {
        field: "tiktok",
        name: "TikTok",
        value: platformValues.tiktok,
        placeholder:
          "@usuario ou https://tiktok.com/@usuario",
        description:
          "Conta utilizada para vídeos curtos e crescimento orgânico.",
      },
      {
        field: "youtube",
        name: "YouTube",
        value: platformValues.youtube,
        placeholder:
          "@canal ou https://youtube.com/@canal",
        description:
          "Canal utilizado para vídeos, Shorts e fortalecimento da marca.",
      },
      {
        field: "facebook",
        name: "Facebook",
        value: platformValues.facebook,
        placeholder:
          "usuario ou https://facebook.com/usuario",
        description:
          "Conta ou página utilizada pela operação.",
      },
    ],
    [platformValues],
  );

  const registeredPlatforms =
    platforms.filter((platform) =>
      Boolean(platform.value.trim()),
    ).length;

  async function savePlatform(
    field: EditableModelField,
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
          "Não foi possível salvar a plataforma.",
      );
    }

    setPlatformValues((current) => ({
      ...current,
      [field]: value.trim(),
    }));
  }

  return (
    <section>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-300">
            Redes sociais
          </p>

          <h2 className="mt-2 text-xl font-bold">
            Plataformas da modelo
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Cadastre, altere e acesse as contas
            utilizadas para divulgação, crescimento e
            aquisição de assinantes.
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Plataformas cadastradas
            </p>

            <p className="mt-2 text-2xl font-bold text-pink-300">
              {registeredPlatforms}
              <span className="text-base text-white/35">
                {" "}
                / {platforms.length}
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

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {platforms.map((platform) => {
          const platformLink =
            createPlatformLink(
              platform.name,
              platform.value,
            );

          return (
            <article
              key={platform.field}
              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                    Plataforma
                  </p>

                  <h3 className="mt-2 text-lg font-bold">
                    {platform.name}
                  </h3>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                    {platform.description}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                    platform.value.trim()
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                      : "border-red-400/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {platform.value.trim()
                    ? "Cadastrada"
                    : "Não cadastrada"}
                </span>
              </div>

              <div className="mt-5">
                {isEditing && canEdit ? (
                  <EditableTextField
                    label="Usuário ou URL do perfil"
                    value={platform.value}
                    placeholder={
                      platform.placeholder
                    }
                    inputType="text"
                    onSave={(value) =>
                      savePlatform(
                        platform.field,
                        value,
                      )
                    }
                  />
                ) : (
                  <PlatformInfo
                    value={platform.value}
                  />
                )}
              </div>

              {platformLink && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={platformLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-xl border border-pink-300/30 bg-pink-300/10 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-pink-200 transition hover:bg-pink-300/20"
                  >
                    Abrir plataforma
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        platform.value,
                      )
                    }
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white/65 transition hover:bg-white/5"
                  >
                    Copiar
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PlatformInfo({
  value,
}: {
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        Usuário ou URL do perfil
      </p>

      <p className="mt-3 break-words text-sm text-white">
        {value.trim() || "Não informado"}
      </p>
    </div>
  );
}

function createPlatformLink(
  platformName: string,
  value: string,
) {
  if (!value.trim()) {
    return null;
  }

  const trimmedValue = value.trim();

  if (
    trimmedValue.startsWith("http://") ||
    trimmedValue.startsWith("https://")
  ) {
    return trimmedValue;
  }

  const username = trimmedValue.replace(
    /^@/,
    "",
  );

  const platformUrls: Record<
    string,
    string
  > = {
    Instagram: `https://www.instagram.com/${username}`,
    "X / Twitter": `https://x.com/${username}`,
    Reddit: `https://www.reddit.com/user/${username}`,
    TikTok: `https://www.tiktok.com/@${username}`,
    YouTube: `https://www.youtube.com/@${username}`,
    Facebook: `https://www.facebook.com/${username}`,
  };

  return platformUrls[platformName] ?? null;
}