"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ModelRowActionsProps = {
  modelId: string;
  displayName: string;
  active: boolean;
};

export default function ModelRowActions({
  modelId,
  displayName,
  active,
}: ModelRowActionsProps) {
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function handleToggle() {
    clearMessages();
    setIsToggling(true);

    try {
      const response = await fetch("/api/models/toggle-active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          active: !active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível alterar o status.");
      }

      setSuccess(
        `${displayName} foi marcada como ${!active ? "ativa" : "inativa"}.`,
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDelete() {
    clearMessages();
    setIsDeleting(true);

    try {
      const response = await fetch("/api/models/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível excluir a modelo.");
      }

      setSuccess(result.message || `${displayName} foi excluída.`);
      setShowDeleteDialog(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isToggling || isDeleting}
          className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
            active
              ? "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
              : "border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          }`}
        >
          {isToggling
            ? "..."
            : active
              ? "Inativar"
              : "Ativar"}
        </button>

        <button
          type="button"
          onClick={() => {
            clearMessages();
            setShowDeleteDialog(true);
          }}
          disabled={isToggling || isDeleting}
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {success && (
        <p className="text-xs text-emerald-400">{success}</p>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111115] p-6">
            <h3 className="text-lg font-bold text-white">
              Excluir modelo
            </h3>

            <p className="mt-3 text-sm text-white/70">
              Tem certeza de que deseja excluir permanentemente{" "}
              <span className="font-bold text-white">
                {displayName}
              </span>
              ? Esta ação não pode ser desfeita.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
