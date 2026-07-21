"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  ManagementRole,
  Model,
} from "@/types/model";

type DocumentsTabProps = {
  model: Model;
  currentUserRole: ManagementRole;
};

type ModelDocument = {
  id: string;
  model_id: string;
  description: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  downloadUrl: string | null;
};

type DocumentsResponse = {
  documents?: ModelDocument[];
  limit?: number;
  error?: string;
};

export default function DocumentsTab({
  model,
  currentUserRole,
}: DocumentsTabProps) {
  const [documents, setDocuments] = useState<
    ModelDocument[]
  >([]);

  const [description, setDescription] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [isEditing, setIsEditing] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUploading, setIsUploading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const canEdit =
    currentUserRole === "owner" ||
    currentUserRole === "administrator";

  const canUpload =
    canEdit && documents.length < 10;

  const loadDocuments = useCallback(
    async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/models/documents?modelId=${encodeURIComponent(
            model.id,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as DocumentsResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Não foi possível carregar os documentos.",
          );
        }

        setDocuments(result.documents ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os documentos.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [model.id],
  );

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleUpload(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canUpload || isUploading) {
      return;
    }

    if (!description.trim()) {
      setErrorMessage(
        "Escreva uma descrição para o arquivo.",
      );
      return;
    }

    if (!selectedFile) {
      setErrorMessage(
        "Selecione um arquivo.",
      );
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();

      formData.append("modelId", model.id);
      formData.append(
        "description",
        description.trim(),
      );
      formData.append("file", selectedFile);

      const response = await fetch(
        "/api/models/documents",
        {
          method: "POST",
          body: formData,
        },
      );

      const result =
        (await response.json()) as {
          document?: ModelDocument;
          error?: string;
        };

      if (!response.ok || !result.document) {
        throw new Error(
          result.error ??
            "Não foi possível enviar o arquivo.",
        );
      }

      setDocuments((current) => [
        result.document as ModelDocument,
        ...current,
      ]);

      setDescription("");
      setSelectedFile(null);
      setSuccessMessage(
        "Arquivo enviado com sucesso.",
      );

      const fileInput =
        document.getElementById(
          "model-document-file",
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o arquivo.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              Arquivos da modelo
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Documentos
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/55">
              PDFs, documentos de identidade,
              fotos de perfil e outros anexos.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40">
                Arquivos enviados
              </p>

              <p className="mt-1 text-xl font-bold text-pink-300">
                {documents.length} / 10
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

      {isEditing && canEdit && (
        <form
          onSubmit={handleUpload}
          className="rounded-2xl border border-pink-400/20 bg-pink-500/5 p-5 sm:p-6"
        >
          <h3 className="text-lg font-bold text-white">
            Adicionar arquivo
          </h3>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Descrição do anexo
              </span>

              <input
                type="text"
                value={description}
                disabled={
                  isUploading || !canUpload
                }
                placeholder="Ex.: Passaporte, RG frente, contrato..."
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-300 disabled:opacity-50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Arquivo
              </span>

              <input
                id="model-document-file"
                type="file"
                disabled={
                  isUploading || !canUpload
                }
                onChange={handleFileChange}
                className="mt-3 block w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-pink-300 file:px-4 file:py-2 file:text-xs file:font-bold file:text-[#321725] disabled:opacity-50"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={
              isUploading || !canUpload
            }
            className="mt-5 rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading
              ? "Enviando..."
              : "Enviar arquivo"}
          </button>

          {!canUpload && (
            <p className="mt-4 text-sm text-yellow-200">
              O limite de 10 arquivos foi
              atingido.
            </p>
          )}
        </form>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/50">
          Carregando documentos...
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
          <p className="text-sm text-white/55">
            Nenhum documento enviado.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {documents.map((item, index) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-pink-300">
                    Anexo {index + 1}
                  </p>

                  <h3 className="mt-2 break-words text-lg font-bold text-white">
                    {item.description}
                  </h3>
                </div>

                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300">
                  Enviado
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <DocumentInfo
                  label="Nome do arquivo"
                  value={item.file_name}
                />

                <DocumentInfo
                  label="Tipo"
                  value={
                    item.mime_type ??
                    "Não informado"
                  }
                />

                <DocumentInfo
                  label="Tamanho"
                  value={formatFileSize(
                    item.file_size,
                  )}
                />

                <DocumentInfo
                  label="Enviado em"
                  value={formatDateTime(
                    item.created_at,
                  )}
                />
              </div>

              {item.downloadUrl ? (
                <a
                  href={item.downloadUrl}
                  className="mt-5 inline-flex rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  Baixar arquivo
                </a>
              ) : (
                <p className="mt-5 text-sm text-red-300">
                  Link de download indisponível.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DocumentInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
        {label}
      </p>

      <p className="mt-1 break-all text-sm text-white/70">
        {value}
      </p>
    </div>
  );
}

function formatFileSize(
  size: number | null,
) {
  if (
    size === null ||
    !Number.isFinite(size)
  ) {
    return "Não informado";
  }

  if (size < 1024) {
    return `${size} bytes`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(
      1,
    )} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDateTime(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}