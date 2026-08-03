"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import RepresentativeModelsDropdown, {
  type RepresentativeModel,
} from "@/components/admin/RepresentativeModelsDropdown";

import {
  deleteRepresentative,
  updateRepresentativeStatus,
  viewAsRepresentative,
} from "./actions";

type RepresentativeRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  active: boolean | null;
  last_login_at: string | null;
  status_changed_at: string | null;
  created_at: string | null;
};

type RepresentativesClientProps = {
  initialStatusFilter: "all" | "ativa" | "inativa" | "arquivada";
  representatives: RepresentativeRow[];
  modelsByRepresentative: Map<string, RepresentativeModel[]>;
  isOwner: boolean;
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "ativa", label: "Ativa" },
  { value: "inativa", label: "Inativa" },
  { value: "arquivada", label: "Arquivada" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  arquivada: "Arquivada",
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RepresentativesClient({
  initialStatusFilter,
  representatives,
  modelsByRepresentative,
  isOwner,
}: RepresentativesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered =
    statusFilter === "all"
      ? representatives
      : representatives.filter((rep) => rep.status === statusFilter);

  async function handleStatusChange(representativeId: string, status: string) {
    const formData = new FormData();
    formData.set("representativeId", representativeId);
    formData.set("status", status);

    startTransition(async () => {
      const result = await updateRepresentativeStatus(null, formData);

      setMessage(result.message);

      if (result.success) {
        router.refresh();
      }
    });
  }

  async function handleDelete(representativeId: string, fullName: string) {
    const phrase = window.prompt(
      `ATENÇÃO: esta ação é irreversível.\n\n` +
        `Digite EXCLUIR para remover permanentemente o representante "${fullName || "sem nome"}".`,
    );

    if (phrase !== "EXCLUIR") {
      return;
    }

    const formData = new FormData();
    formData.set("representativeId", representativeId);
    formData.set("confirmation", "EXCLUIR");

    setDeletingId(representativeId);

    startTransition(async () => {
      const result = await deleteRepresentative(null, formData);

      setDeletingId(null);
      setMessage(result.message);

      if (result.success) {
        router.refresh();
      }
    });
  }

  async function handleViewAs(representativeId: string) {
    startTransition(async () => {
      await viewAsRepresentative(representativeId);
    });
  }

  return (
    <>
      {message && (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 text-sm ${
            message.includes("sucesso") || message.includes("excluído")
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setStatusFilter(option.value);
              setMessage(null);
            }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              statusFilter === option.value
                ? "border-pink-400/50 bg-pink-500/20 text-pink-200"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-5 py-4 font-semibold">Nome</th>
                <th className="px-5 py-4 font-semibold">Contato</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Modelos</th>
                <th className="px-5 py-4 font-semibold">Último acesso</th>
                <th className="px-5 py-4 font-semibold">Desde</th>
                <th className="px-5 py-4 font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-white/40"
                  >
                    Nenhum representante encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((rep) => (
                  <tr
                    key={rep.id}
                    className="transition hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-white/90">
                        {rep.full_name || "Sem nome"}
                      </p>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <p className="text-white/70">{rep.email || "—"}</p>
                      <p className="mt-1 text-white/50">{rep.phone || "—"}</p>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          rep.status === "ativa"
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : rep.status === "inativa"
                              ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                              : "border-white/15 bg-white/5 text-white/50"
                        }`}
                      >
                        {STATUS_LABELS[rep.status ?? ""] || rep.status || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4 align-top text-white/70">
                      <RepresentativeModelsDropdown
                        representativeId={rep.id}
                        models={modelsByRepresentative.get(rep.id) ?? []}
                      />
                    </td>

                    <td className="px-5 py-4 align-top text-white/50">
                      {formatDate(rep.last_login_at)}
                    </td>

                    <td className="px-5 py-4 align-top text-white/50">
                      {formatDate(rep.created_at)}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {rep.status !== "ativa" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(rep.id, "ativa")}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            Ativar
                          </button>
                        )}

                        {rep.status !== "inativa" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(rep.id, "inativa")}
                            className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
                          >
                            Inativar
                          </button>
                        )}

                        {rep.status !== "arquivada" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(rep.id, "arquivada")}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
                          >
                            Arquivar
                          </button>
                        )}

                        {rep.status === "ativa" && (
                          <button
                            type="button"
                            disabled={isPending || deletingId === rep.id}
                            onClick={() => handleViewAs(rep.id)}
                            className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-3 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20 disabled:opacity-40"
                          >
                            Ver como ele vê
                          </button>
                        )}

                        {isOwner && (
                          <button
                            type="button"
                            disabled={isPending || deletingId === rep.id}
                            onClick={() =>
                              handleDelete(
                                rep.id,
                                rep.full_name || "",
                              )
                            }
                            className="rounded-lg border border-red-600/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
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
      </div>
    </>
  );
}
