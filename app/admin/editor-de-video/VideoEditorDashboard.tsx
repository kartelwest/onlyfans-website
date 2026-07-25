"use client";

import { useState } from "react";

import {
  approveVideoJob,
  createDefaultTemplates,
  createVideoJob,
  reprocessVideoJob,
  rejectVideoJob,
} from "@/lib/video/jobs";
import { videoPlatformLabels, type VideoJobStatus } from "@/lib/video/types";

interface JobRow {
  id: string;
  status: VideoJobStatus;
  progress: number;
  retry_count: number;
  cost_estimate: number;
  cost_actual: number;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  asset: {
    id: string;
    original_filename: string;
    model: {
      slug: string;
      display_name: string;
      stage_name: string | null;
    } | null;
  } | null;
  template: {
    id: string;
    name: string;
    target_platform: string;
    aspect: string;
  } | null;
}

interface TemplateRow {
  id: string;
  name: string;
  target_platform: string;
  aspect: string;
}

interface ModelRow {
  id: string;
  display_name: string;
  stage_name: string | null;
}

export interface VideoEditorDashboardProps {
  initialJobs: JobRow[];
  initialTemplates: TemplateRow[];
  initialModels: ModelRow[];
}

const statusLabels: Record<VideoJobStatus, string> = {
  new: "Novo",
  awaiting_configuration: "Aguardando configuração",
  awaiting_approval: "Aguardando aprovação",
  queued: "Na fila",
  downloading: "Baixando",
  preparing: "Preparando",
  processing: "Processando",
  rendering_captions: "Gerando legendas",
  rendering: "Renderizando",
  sending: "Enviando",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function VideoEditorDashboard({
  initialJobs,
  initialTemplates,
  initialModels,
}: VideoEditorDashboardProps) {
  const [templates] = useState<TemplateRow[]>(initialTemplates);
  const [models] = useState<ModelRow[]>(initialModels);
  const jobs = initialJobs;
  const [modelId, setModelId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const counts = {
    new: jobs.filter((j) => j.status === "new").length,
    queued: jobs.filter((j) => j.status === "queued").length,
    processing: jobs.filter((j) =>
      ["downloading", "preparing", "processing", "rendering_captions", "rendering", "sending"].includes(j.status),
    ).length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    awaiting: jobs.filter((j) => j.status === "awaiting_approval").length,
  };

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId || !templateId || !file) {
      setMessage("Preencha modelo, template e arquivo.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("modelId", modelId);
    formData.append("templateId", templateId);
    formData.append("file", file);
    if (instructions.trim()) {
      formData.append("instructions", instructions.trim());
    }

    try {
      await createVideoJob(formData);
      setMessage("Vídeo enviado com sucesso.");
      setFile(null);
      setInstructions("");
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao enviar vídeo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "approve" | "reject" | "reprocess", jobId: string) {
    setMessage(null);
    try {
      if (action === "approve") {
        await approveVideoJob({ jobId });
      } else if (action === "reject") {
        await rejectVideoJob({ jobId });
      } else {
        await reprocessVideoJob({ jobId });
      }
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro na ação.");
    }
  }

  async function seedTemplates() {
    try {
      await createDefaultTemplates();
      setMessage("Templates padrão criados.");
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar templates.");
    }
  }

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY Models
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Editor de Vídeo</h1>
            <p className="mt-2 text-sm text-white/55">
              Upload, templates e acompanhamento de processamento.
            </p>
          </div>
          <button
            onClick={seedTemplates}
            type="button"
            className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
          >
            Criar templates padrão
          </button>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <MetricCard label="Novos" value={counts.new} />
          <MetricCard label="Na fila" value={counts.queued} />
          <MetricCard label="Em processamento" value={counts.processing} />
          <MetricCard label="Concluídos" value={counts.completed} />
          <MetricCard label="Falhas" value={counts.failed} />
          <MetricCard label="Aguardando aprovação" value={counts.awaiting} />
        </section>

        {message && (
          <div className="mt-6 rounded-xl border border-pink-400/30 bg-pink-500/10 p-4 text-sm text-pink-100">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111115] p-6">
          <h2 className="text-lg font-bold">Enviar vídeo manualmente</h2>
          <form onSubmit={handleUpload} className="mt-4 grid gap-4 lg:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-white/50">Modelo</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#1a1a1e] px-4 py-3 text-sm outline-none focus:border-pink-400"
              >
                <option value="">Selecione...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                    {m.stage_name ? ` (${m.stage_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 lg:col-span-2">
              <label className="text-xs font-semibold uppercase text-white/50">Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#1a1a1e] px-4 py-3 text-sm outline-none focus:border-pink-400"
              >
                <option value="">Selecione...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({videoPlatformLabels[t.target_platform as keyof typeof videoPlatformLabels] ?? t.target_platform})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 lg:col-span-2">
              <label className="text-xs font-semibold uppercase text-white/50">Arquivo</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-lg border border-white/10 bg-[#1a1a1e] px-4 py-2.5 text-sm file:mr-3 file:rounded file:bg-pink-500 file:px-3 file:py-1 file:text-xs file:font-bold file:text-white"
              />
            </div>

            <div className="flex flex-col gap-1 lg:col-span-5">
              <label className="text-xs font-semibold uppercase text-white/50">
                Instruções em linguagem natural (opcional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: Corte os primeiros 5 segundos, adicione o nome artístico embaixo e ajuste o brilho..."
                className="rounded-lg border border-white/10 bg-[#1a1a1e] px-4 py-3 text-sm outline-none focus:border-pink-400"
                rows={2}
              />
            </div>

            <div className="lg:col-span-5">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar para fila"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <div className="border-b border-pink-400/20 bg-[#2a1521] px-6 py-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">Jobs de vídeo</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-[#2a1521] text-left">
                <tr className="border-b border-pink-400/20 text-xs uppercase tracking-wide text-pink-200/70">
                  <th className="px-4 py-3 font-semibold">Modelo</th>
                  <th className="px-4 py-3 font-semibold">Arquivo</th>
                  <th className="px-4 py-3 font-semibold">Template</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Progresso</th>
                  <th className="px-4 py-3 font-semibold">Custo estimado</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-white/50">
                      Nenhum job de vídeo ainda.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b border-white/10 text-sm hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        {job.asset?.model ? (
                          <>
                            <span className="font-semibold text-white">{job.asset.model.display_name}</span>
                            {job.asset.model.stage_name && (
                              <p className="text-xs text-white/45">{job.asset.model.stage_name}</p>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/80">{job.asset?.original_filename ?? "—"}</td>
                      <td className="px-4 py-3 text-white/80">
                        {job.template?.name ?? "—"}
                        {job.template && (
                          <p className="text-xs text-white/45">
                            {videoPlatformLabels[job.template.target_platform as keyof typeof videoPlatformLabels] ?? job.template.target_platform}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-pink-500 transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/50">{job.progress}%</span>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {job.cost_estimate ? `$${Number(job.cost_estimate).toFixed(4)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(job.status === "new" || job.status === "awaiting_approval") && (
                            <ActionButton
                              onClick={() => handleAction("approve", job.id)}
                              variant="green"
                            >
                              Aprovar
                            </ActionButton>
                          )}
                          {(job.status === "new" || job.status === "awaiting_approval") && (
                            <ActionButton
                              onClick={() => handleAction("reject", job.id)}
                              variant="red"
                            >
                              Rejeitar
                            </ActionButton>
                          )}
                          {(job.status === "failed" || job.status === "completed") && (
                            <ActionButton
                              onClick={() => handleAction("reprocess", job.id)}
                              variant="default"
                            >
                              Reprocessar
                            </ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111115] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-bold text-pink-300">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: VideoJobStatus }) {
  const colors: Record<VideoJobStatus, string> = {
    new: "bg-white/10 text-white/70",
    awaiting_configuration: "bg-yellow-500/10 text-yellow-200",
    awaiting_approval: "bg-orange-500/10 text-orange-200",
    queued: "bg-blue-500/10 text-blue-200",
    downloading: "bg-blue-500/10 text-blue-200",
    preparing: "bg-blue-500/10 text-blue-200",
    processing: "bg-purple-500/10 text-purple-200",
    rendering_captions: "bg-purple-500/10 text-purple-200",
    rendering: "bg-purple-500/10 text-purple-200",
    sending: "bg-purple-500/10 text-purple-200",
    completed: "bg-green-500/10 text-green-200",
    failed: "bg-red-500/10 text-red-200",
    cancelled: "bg-white/10 text-white/50",
  };

  return (
    <span className={classNames("rounded-full px-3 py-1 text-xs font-bold", colors[status])}>
      {statusLabels[status]}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant: "default" | "green" | "red";
}) {
  const variants = {
    default: "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
    green: "border-green-400/30 bg-green-500/10 text-green-200 hover:bg-green-500/20",
    red: "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames("rounded-lg px-3 py-1.5 text-xs font-bold transition", variants[variant])}
    >
      {children}
    </button>
  );
}
