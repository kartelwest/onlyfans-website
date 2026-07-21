"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ManagementRole } from "@/types/model";

type EarningsPlatform = "OnlyFans" | "Fansly";

type EarningsReport = {
  id: string;
  modelId: string;
  platform: EarningsPlatform;
  period: string;
  grossRevenue: number;
  modelShare: number;
  agencyShare: number;
  marketingShare: number;
  reportDate: string | null;
  visibleToModel: boolean;
  adminNote: string | null;
  imagePath: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type ModelEarningsPanelProps = {
  modelId: string;
  modelName: string;
  currentUserRole: ManagementRole;
};

type ApiErrorResponse = {
  error?: string;
};

type ReportsApiResponse = {
  reports?: EarningsReport[];
  error?: string;
};

type CreateReportApiResponse = {
  report?: EarningsReport;
  error?: string;
};

const managementRoles: ManagementRole[] = [
  "owner",
  "administrator",
];

const agencyOnlyRoles: ManagementRole[] = [
  "owner",
  "administrator",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const acceptedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Data não informada";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTodayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(
    now.getTime() - offset * 60 * 1000,
  );

  return localDate.toISOString().split("T")[0];
}

function getErrorMessage(
  data: ApiErrorResponse | null,
  fallback: string,
) {
  if (data?.error?.trim()) {
    return data.error;
  }

  return fallback;
}

export default function ModelEarningsPanel({
  modelId,
  modelName,
  currentUserRole,
}: ModelEarningsPanelProps) {
  const canManage =
    managementRoles.includes(currentUserRole);

  const canSeeFansly =
    agencyOnlyRoles.includes(currentUserRole);

  const [reports, setReports] = useState<
    EarningsReport[]
  >([]);

  const [platform, setPlatform] =
    useState<EarningsPlatform>("OnlyFans");

  const [period, setPeriod] = useState("");
  const [grossRevenue, setGrossRevenue] =
    useState("");

  const [reportDate, setReportDate] = useState(
    getTodayForInput(),
  );

  const [adminNote, setAdminNote] =
    useState("");

  const [visibleToModel, setVisibleToModel] =
    useState(true);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<
    string | null
  >(null);

  const [selectedImage, setSelectedImage] =
    useState<EarningsReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] =
    useState(false);

  const [deletingId, setDeletingId] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/models/earnings?modelId=${encodeURIComponent(
          modelId,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as ReportsApiResponse;

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Não foi possível carregar os ganhos.",
          ),
        );
      }

      setReports(data.reports ?? []);
    } catch (error) {
      console.error(
        "Erro ao carregar os ganhos:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os ganhos.",
      );
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl =
      URL.createObjectURL(selectedFile);

    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successMessage]);

  const visibleReports = useMemo(() => {
    if (canSeeFansly) {
      return reports;
    }

    return reports.filter(
      (report) =>
        report.platform !== "Fansly",
    );
  }, [reports, canSeeFansly]);

  const totals = useMemo(() => {
    return visibleReports.reduce(
      (accumulator, report) => ({
        gross:
          accumulator.gross +
          report.grossRevenue,

        model:
          accumulator.model +
          report.modelShare,

        agency:
          accumulator.agency +
          report.agencyShare,

        marketing:
          accumulator.marketing +
          report.marketingShare,
      }),
      {
        gross: 0,
        model: 0,
        agency: 0,
        marketing: 0,
      },
    );
  }, [visibleReports]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!acceptedImageTypes.includes(file.type)) {
      setSelectedFile(null);
      event.target.value = "";

      setErrorMessage(
        "Selecione uma imagem JPG, PNG ou WEBP.",
      );

      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setSelectedFile(null);
      event.target.value = "";

      setErrorMessage(
        "A imagem deve ter no máximo 10 MB.",
      );

      return;
    }

    setSelectedFile(file);
  }

  function resetForm() {
    setPlatform("OnlyFans");
    setPeriod("");
    setGrossRevenue("");
    setReportDate(getTodayForInput());
    setAdminNote("");
    setVisibleToModel(true);
    setSelectedFile(null);

    const input = document.getElementById(
      "earnings-screenshot",
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canManage || uploading) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedGrossRevenue =
      Number(grossRevenue);

    if (!period.trim()) {
      setErrorMessage(
        "Informe o período do lançamento.",
      );
      return;
    }

    if (
      Number.isNaN(parsedGrossRevenue) ||
      parsedGrossRevenue < 0
    ) {
      setErrorMessage(
        "Informe uma receita bruta válida.",
      );
      return;
    }

    if (!selectedFile) {
      setErrorMessage(
        "Selecione a captura de tela dos ganhos.",
      );
      return;
    }

    if (
      platform === "Fansly" &&
      !canSeeFansly
    ) {
      setErrorMessage(
        "Você não tem permissão para registrar ganhos da Fansly.",
      );
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("modelId", modelId);
      formData.append("platform", platform);
      formData.append("period", period.trim());

      formData.append(
        "grossRevenue",
        String(parsedGrossRevenue),
      );

      formData.append(
        "reportDate",
        reportDate,
      );

      formData.append(
        "visibleToModel",
        String(visibleToModel),
      );

      formData.append(
        "adminNote",
        adminNote.trim(),
      );

      formData.append(
        "image",
        selectedFile,
      );

      const response = await fetch(
        "/api/models/earnings",
        {
          method: "POST",
          body: formData,
        },
      );

      const data =
        (await response.json()) as CreateReportApiResponse;

      if (!response.ok || !data.report) {
        throw new Error(
          getErrorMessage(
            data,
            "Não foi possível salvar o relatório.",
          ),
        );
      }

      setReports((currentReports) => [
        data.report as EarningsReport,
        ...currentReports,
      ]);

      resetForm();

      setSuccessMessage(
        "Relatório de ganhos salvo com sucesso.",
      );
    } catch (error) {
      console.error(
        "Erro ao salvar o relatório:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o relatório.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(
    report: EarningsReport,
  ) {
    if (!canManage || deletingId) {
      return;
    }

    const confirmed = window.confirm(
      `Excluir o relatório de ${report.period}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(report.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/models/earnings/${encodeURIComponent(
          report.id,
        )}`,
        {
          method: "DELETE",
        },
      );

      const data =
        (await response.json()) as ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Não foi possível excluir o relatório.",
          ),
        );
      }

      setReports((currentReports) =>
        currentReports.filter(
          (currentReport) =>
            currentReport.id !== report.id,
        ),
      );

      if (selectedImage?.id === report.id) {
        setSelectedImage(null);
      }

      setSuccessMessage(
        "Relatório excluído com sucesso.",
      );
    } catch (error) {
      console.error(
        "Erro ao excluir o relatório:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o relatório.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-emerald-400/20 bg-[#111114] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Financeiro
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Ganhos — {modelName}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Registre os ganhos e anexe a
              captura de tela correspondente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard
              label="Receita bruta"
              value={totals.gross}
            />

            <SummaryCard
              label="Modelo"
              value={totals.model}
            />

            <SummaryCard
              label="Agência"
              value={totals.agency}
            />

            <SummaryCard
              label="Marketing"
              value={totals.marketing}
            />
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Plataforma
                </span>

                <select
                  value={platform}
                  onChange={(event) =>
                    setPlatform(
                      event.target
                        .value as EarningsPlatform,
                    )
                  }
                  disabled={uploading}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="OnlyFans">
                    OnlyFans
                  </option>

                  {canSeeFansly && (
                    <option value="Fansly">
                      Fansly — agência
                    </option>
                  )}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Período
                </span>

                <input
                  type="text"
                  value={period}
                  onChange={(event) =>
                    setPeriod(event.target.value)
                  }
                  disabled={uploading}
                  placeholder="Ex.: Julho 2026"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Receita bruta
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={grossRevenue}
                  onChange={(event) =>
                    setGrossRevenue(
                      event.target.value,
                    )
                  }
                  disabled={uploading}
                  placeholder="0.00"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Data
                </span>

                <input
                  type="date"
                  value={reportDate}
                  onChange={(event) =>
                    setReportDate(
                      event.target.value,
                    )
                  }
                  disabled={uploading}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Observação interna
                </span>

                <textarea
                  value={adminNote}
                  onChange={(event) =>
                    setAdminNote(
                      event.target.value,
                    )
                  }
                  disabled={uploading}
                  rows={4}
                  placeholder="Informação opcional para a administração"
                  className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div>
                <label
                  htmlFor="earnings-screenshot"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
                >
                  Captura de tela
                </label>

                <input
                  id="earnings-screenshot"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="mt-2 block w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-950 text-sm text-zinc-400 file:mr-4 file:border-0 file:bg-emerald-400 file:px-4 file:py-3 file:font-bold file:text-black hover:file:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  JPG, PNG ou WEBP. Máximo de
                  10 MB. Uma imagem por
                  lançamento.
                </p>
              </div>
            </div>

            {previewUrl && (
              <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Pré-visualização
                </p>

                <img
                  src={previewUrl}
                  alt="Pré-visualização da captura de ganhos"
                  className="max-h-[420px] w-full rounded-lg object-contain"
                />
              </div>
            )}

            <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={visibleToModel}
                  onChange={(event) =>
                    setVisibleToModel(
                      event.target.checked,
                    )
                  }
                  disabled={uploading}
                  className="h-4 w-4 rounded border-white/20 bg-zinc-950 accent-emerald-400"
                />

                <span className="text-sm text-zinc-300">
                  Visível para a modelo
                </span>
              </label>

              <button
                type="submit"
                disabled={uploading}
                className="rounded-lg bg-emerald-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading
                  ? "Salvando..."
                  : "Adicionar lançamento"}
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-500">
              OnlyFans: 60% modelo, 20% agência
              e 20% marketing. Fansly: 100% da
              agência e visível apenas para
              proprietário e administrador.
            </p>
          </form>
        )}

        <div className="mt-7 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-3">
                  Imagem
                </th>

                <th className="px-3 py-3">
                  Plataforma
                </th>

                <th className="px-3 py-3">
                  Período
                </th>

                <th className="px-3 py-3">
                  Bruto
                </th>

                <th className="px-3 py-3">
                  Modelo
                </th>

                <th className="px-3 py-3">
                  Agência
                </th>

                <th className="px-3 py-3">
                  Marketing
                </th>

                <th className="px-3 py-3">
                  Data
                </th>

                {canManage && (
                  <th className="px-3 py-3 text-right">
                    Ações
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={canManage ? 9 : 8}
                    className="px-3 py-12 text-center text-zinc-500"
                  >
                    Carregando lançamentos...
                  </td>
                </tr>
              ) : visibleReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 9 : 8}
                    className="px-3 py-12 text-center text-zinc-500"
                  >
                    Nenhum lançamento financeiro
                    registrado.
                  </td>
                </tr>
              ) : (
                visibleReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-white/[0.06] text-zinc-300"
                  >
                    <td className="px-3 py-4">
                      {report.imageUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImage(
                              report,
                            )
                          }
                          className="group block overflow-hidden rounded-lg border border-white/10 bg-black/30"
                        >
                          <img
                            src={report.imageUrl}
                            alt={`Ganhos de ${report.period}`}
                            className="h-16 w-24 object-cover transition group-hover:scale-105"
                          />
                        </button>
                      ) : (
                        <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-xs text-zinc-600">
                          Sem imagem
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={
                          report.platform ===
                          "Fansly"
                            ? "rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-300"
                            : "rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-300"
                        }
                      >
                        {report.platform}
                      </span>
                    </td>

                    <td className="px-3 py-4 font-medium text-white">
                      {report.period}

                      {canManage &&
                        report.adminNote && (
                          <p className="mt-1 max-w-xs text-xs font-normal leading-5 text-zinc-500">
                            {report.adminNote}
                          </p>
                        )}

                      {canManage && (
                        <p className="mt-1 text-[11px] font-normal text-zinc-600">
                          {report.visibleToModel
                            ? "Visível para a modelo"
                            : "Oculto da modelo"}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {formatCurrency(
                        report.grossRevenue,
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {formatCurrency(
                        report.modelShare,
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {formatCurrency(
                        report.agencyShare,
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {formatCurrency(
                        report.marketingShare,
                      )}
                    </td>

                    <td className="px-3 py-4">
                      <p className="text-sm text-zinc-300">
                        {formatDate(
                          report.reportDate,
                        )}
                      </p>

                      <p className="mt-1 text-[11px] text-zinc-600">
                        Salvo em{" "}
                        {formatDateTime(
                          report.createdAt,
                        )}
                      </p>
                    </td>

                    {canManage && (
                      <td className="px-3 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void handleDelete(
                              report,
                            )
                          }
                          disabled={
                            deletingId ===
                            report.id
                          }
                          className="text-xs font-semibold text-red-300 transition hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === report.id
                            ? "Excluindo..."
                            : "Excluir"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedImage?.imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Captura de ganhos de ${selectedImage.period}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() =>
            setSelectedImage(null)
          }
        >
          <div
            className="relative max-h-[95vh] w-full max-w-6xl overflow-auto rounded-2xl border border-white/10 bg-[#111114] p-4 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  {selectedImage.platform}
                </p>

                <h3 className="mt-1 text-xl font-bold text-white">
                  {selectedImage.period}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {formatDate(
                    selectedImage.reportDate,
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedImage(null)
                }
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <img
              src={selectedImage.imageUrl}
              alt={`Captura de ganhos de ${selectedImage.period}`}
              className="mx-auto max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </>
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
    <div className="min-w-[130px] rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-white">
        {formatCurrency(value)}
      </p>
    </div>
  );
}