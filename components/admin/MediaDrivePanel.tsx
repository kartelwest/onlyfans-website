"use client";

import { useEffect, useMemo, useState } from "react";

type BackofficeRole =
  | "owner"
  | "administrator"
  | "staff"
  | "model";

type MediaType = "Foto" | "Vídeo";

type MediaStatus =
  | "Recebido"
  | "Em revisão"
  | "Aprovado"
  | "Publicado"
  | "Remover do Drive";

type MediaRecord = {
  id: string;
  fileName: string;
  mediaType: MediaType;
  platform: string;
  driveUrl: string;
  status: MediaStatus;
  uploadedBy: string;
  uploadedAt: string;
  publishedAt: string;
  notes: string;
};

type MediaDrivePanelProps = {
  slug: string;
  modelName: string;
  currentUserRole: BackofficeRole;
};

const allowedRoles: BackofficeRole[] = [
  "owner",
  "administrator",
  "staff",
  "model",
];

const platforms = [
  "OnlyFans",
  "Instagram",
  "X / Twitter",
  "TikTok",
  "Reddit",
  "Fansly",
  "Outros",
];

const statuses: MediaStatus[] = [
  "Recebido",
  "Em revisão",
  "Aprovado",
  "Publicado",
  "Remover do Drive",
];

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function formatDateTime(value: string) {
  if (!value) {
    return "Não registrado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MediaDrivePanel({
  slug,
  modelName,
  currentUserRole,
}: MediaDrivePanelProps) {
  const canAccess =
    allowedRoles.includes(currentUserRole);

  const canDelete =
    currentUserRole === "owner" ||
    currentUserRole === "administrator";

  const storageKey =
    `karaymodels-media-drive-${slug}`;

  const [records, setRecords] = useState<
    MediaRecord[]
  >([]);

  const [hasLoaded, setHasLoaded] =
    useState(false);

  const [fileName, setFileName] =
    useState("");
  const [mediaType, setMediaType] =
    useState<MediaType>("Foto");
  const [platform, setPlatform] =
    useState("OnlyFans");
  const [driveUrl, setDriveUrl] =
    useState("");
  const [uploadedBy, setUploadedBy] =
    useState(modelName);
  const [notes, setNotes] =
    useState("");

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(storageKey);

      if (saved) {
        setRecords(
          JSON.parse(saved) as MediaRecord[]
        );
      }
    } catch (error) {
      console.error(
        "Não foi possível carregar os arquivos de mídia:",
        error
      );
    } finally {
      setHasLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(records)
      );
    } catch (error) {
      console.error(
        "Não foi possível salvar os arquivos de mídia:",
        error
      );
    }
  }, [records, storageKey, hasLoaded]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      received: records.filter(
        (item) => item.status === "Recebido"
      ).length,
      review: records.filter(
        (item) => item.status === "Em revisão"
      ).length,
      approved: records.filter(
        (item) => item.status === "Aprovado"
      ).length,
      published: records.filter(
        (item) => item.status === "Publicado"
      ).length,
      removal: records.filter(
        (item) =>
          item.status === "Remover do Drive"
      ).length,
    };
  }, [records]);

  if (!canAccess) {
    return null;
  }

  function addRecord() {
    if (!fileName.trim()) {
      window.alert(
        "Informe o nome do arquivo."
      );
      return;
    }

    if (!driveUrl.trim()) {
      window.alert(
        "Cole o link do arquivo ou da pasta no Google Drive."
      );
      return;
    }

    const newRecord: MediaRecord = {
      id: createId(),
      fileName: fileName.trim(),
      mediaType,
      platform,
      driveUrl: driveUrl.trim(),
      status: "Recebido",
      uploadedBy:
        uploadedBy.trim() || modelName,
      uploadedAt: new Date().toISOString(),
      publishedAt: "",
      notes: notes.trim(),
    };

    setRecords((current) => [
      newRecord,
      ...current,
    ]);

    setFileName("");
    setDriveUrl("");
    setNotes("");
  }

  function updateStatus(
    id: string,
    status: MediaStatus
  ) {
    setRecords((current) =>
      current.map((record) =>
        record.id === id
          ? {
              ...record,
              status,
              publishedAt:
                status === "Publicado"
                  ? new Date().toISOString()
                  : record.publishedAt,
            }
          : record
      )
    );
  }

  function deleteRecord(id: string) {
    if (!canDelete) {
      return;
    }

    const confirmed = window.confirm(
      "Excluir este registro de mídia? Isso não exclui o arquivo do Google Drive."
    );

    if (!confirmed) {
      return;
    }

    setRecords((current) =>
      current.filter(
        (record) => record.id !== id
      )
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-[#111114] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Google Drive
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Fotos e vídeos — {modelName}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            O Google Drive será usado somente para
            fotos e vídeos. Documentos, checklist,
            tarefas, notas e informações financeiras
            serão armazenados no banco de dados.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SummaryCard
            label="Total"
            value={summary.total}
          />
          <SummaryCard
            label="Em revisão"
            value={summary.review}
          />
          <SummaryCard
            label="Publicados"
            value={summary.published}
          />
        </div>
      </div>

      <div className="mt-7 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Nome do arquivo"
            value={fileName}
            onChange={setFileName}
            placeholder="Ex.: foto-praia-001.jpg"
          />

          <label>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Tipo de mídia
            </span>

            <select
              value={mediaType}
              onChange={(event) =>
                setMediaType(
                  event.target.value as MediaType
                )
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="Foto">Foto</option>
              <option value="Vídeo">Vídeo</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Plataforma
            </span>

            <select
              value={platform}
              onChange={(event) =>
                setPlatform(event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
            >
              {platforms.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Link do Google Drive"
            value={driveUrl}
            onChange={setDriveUrl}
            placeholder="Cole o link da foto, vídeo ou pasta"
            type="url"
          />

          <Field
            label="Enviado por"
            value={uploadedBy}
            onChange={setUploadedBy}
            placeholder="Nome da modelo ou funcionário"
          />

          <Field
            label="Observações"
            value={notes}
            onChange={setNotes}
            placeholder="Informação opcional"
          />
        </div>

        <button
          type="button"
          onClick={addRecord}
          className="mt-4 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
        >
          Adicionar mídia
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-3">
                Arquivo
              </th>
              <th className="px-3 py-3">
                Plataforma
              </th>
              <th className="px-3 py-3">
                Status
              </th>
              <th className="px-3 py-3">
                Enviado por
              </th>
              <th className="px-3 py-3">
                Datas
              </th>
              <th className="px-3 py-3 text-right">
                Ações
              </th>
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-zinc-500"
                >
                  Nenhuma foto ou vídeo registrado.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-white/[0.06] text-zinc-300"
                >
                  <td className="px-3 py-4">
                    <a
                      href={record.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-cyan-300 transition hover:text-cyan-200"
                    >
                      {record.fileName}
                    </a>

                    <p className="mt-1 text-xs text-zinc-500">
                      {record.mediaType}
                    </p>

                    {record.notes && (
                      <p className="mt-1 max-w-sm text-xs text-zinc-500">
                        {record.notes}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-4">
                    {record.platform}
                  </td>

                  <td className="px-3 py-4">
                    <select
                      value={record.status}
                      onChange={(event) =>
                        updateStatus(
                          record.id,
                          event.target
                            .value as MediaStatus
                        )
                      }
                      className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      {statuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-4">
                    {record.uploadedBy}
                  </td>

                  <td className="px-3 py-4 text-xs text-zinc-500">
                    <p>
                      Enviado:{" "}
                      {formatDateTime(
                        record.uploadedAt
                      )}
                    </p>

                    {record.publishedAt && (
                      <p className="mt-1">
                        Publicado:{" "}
                        {formatDateTime(
                          record.publishedAt
                        )}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <a
                        href={record.driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
                      >
                        Abrir
                      </a>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() =>
                            deleteRecord(
                              record.id
                            )
                          }
                          className="text-xs font-semibold text-red-300 transition hover:text-red-200"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Regra de armazenamento
        </p>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Depois que a mídia for publicada e
          confirmada, o status pode ser alterado para
          “Remover do Drive”. A exclusão real do
          arquivo será feita pela integração do Google
          Drive. O banco de dados manterá apenas o
          histórico e os metadados.
        </p>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[120px] rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "url";
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400"
      />
    </label>
  );
}