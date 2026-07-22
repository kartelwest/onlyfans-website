"use client";

import { useEffect, useState } from "react";

import type {
  ManagementRole,
  ModelAuditLog,
} from "@/types/model";

type HistoryTabProps = {
  modelId: string;
  currentUserRole: ManagementRole;
};

type ApiResponse = {
  logs?: ModelAuditLog[];
  error?: string;
};

const fieldLabels: Record<string, string> = {
  fullName: "Nome completo",
  stageName: "Nome artístico",
  birthday: "Nascimento",
  city: "Cidade",
  nationality: "Nacionalidade",
  language: "Idioma",
  email: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  twitter: "X / Twitter",
  reddit: "Reddit",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
  driveOnlyfans: "Pasta OnlyFans",
  driveInstagram: "Pasta Instagram",
  driveTwitter: "Pasta X / Twitter",
  driveVideos: "Pasta de Vídeos",
  drivePhotos: "Pasta de Fotos",
  profilePhotoUrl: "Foto de perfil",
};

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  administrator: "Administrador",
  representative: "Representante",
  model: "Modelo",
};

function getFieldLabel(field: string): string {
  if (field.startsWith("checklist.")) {
    return `Checklist: ${field.replace("checklist.", "")}`;
  }

  return fieldLabels[field] ?? field;
}

export default function HistoryTab({
  modelId,
  currentUserRole,
}: HistoryTabProps) {
  const [logs, setLogs] = useState<ModelAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/models/audit?modelId=${modelId}`,
        );

        const data = (await response.json()) as ApiResponse;

        if (!response.ok || data.error) {
          throw new Error(
            data.error ?? "Erro ao carregar histórico.",
          );
        }

        setLogs(data.logs ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erro ao carregar histórico.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadLogs();
  }, [modelId]);

  if (currentUserRole === "model") {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111115] p-8 text-center">
        <p className="text-sm text-white/45">
          Você não tem permissão para visualizar o histórico.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111115] p-8 text-center">
        <p className="text-sm text-white/55">
          Carregando histórico...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
        <p className="text-sm font-semibold text-red-300">
          {error}
        </p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111115] p-8 text-center">
        <p className="text-sm text-white/45">
          Nenhuma alteração registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#111115] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
          Histórico de Alterações
        </p>

        <p className="mt-2 text-sm text-white/55">
          Registro de todas as modificações feitas no perfil da modelo.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="bg-[#2a1521] text-left">
              <tr className="border-b border-pink-400/20">
                <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Data
                </th>
                <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Usuário
                </th>
                <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Campo
                </th>
                <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Valor anterior
                </th>
                <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Novo valor
                </th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-white/10 transition hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-4 align-middle text-sm text-white/60">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <p className="text-sm font-semibold text-white">
                      {log.actorName ?? "Sistema"}
                    </p>
                    {log.actorRole && (
                      <p className="mt-1 text-xs text-white/45">
                        {roleLabels[log.actorRole] ?? log.actorRole}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <span className="rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-200">
                      {getFieldLabel(log.field)}
                    </span>
                  </td>

                  <td className="px-5 py-4 align-middle text-sm text-white/55">
                    {log.oldValue || (
                      <span className="text-white/30">—</span>
                    )}
                  </td>

                  <td className="px-5 py-4 align-middle text-sm text-white">
                    {log.newValue || (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
