"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { StaffAccountStatus } from "@/lib/staff/representatives";

type StaffAccountActionsProps = {
  userId: string;
  displayName: string;
  status: StaffAccountStatus;
  /** Permanent deletion is the owner's alone; everyone else archives. */
  canDelete: boolean;
  assignedModels: number;
};

const statusOptions: {
  value: StaffAccountStatus;
  label: string;
  className: string;
}[] = [
  {
    value: "active",
    label: "Ativo",
    className: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  },
  {
    value: "inactive",
    label: "Inativo",
    className: "border-white/15 bg-white/5 text-white/60",
  },
  {
    value: "archived",
    label: "Arquivado",
    className: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  },
];

export default function StaffAccountActions({
  userId,
  displayName,
  status,
  canDelete,
  assignedModels,
}: StaffAccountActionsProps) {
  const router = useRouter();

  const [currentStatus, setCurrentStatus] =
    useState<StaffAccountStatus>(status);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleStatusChange(next: StaffAccountStatus) {
    if (next === currentStatus || isSaving) {
      return;
    }

    const previous = currentStatus;

    setCurrentStatus(next);
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível alterar o status.");
      }

      setSuccess(result.message || "Status atualizado.");
      router.refresh();
    } catch (err) {
      setCurrentStatus(previous);
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setError("");
    setSuccess("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível excluir a conta.");
      }

      setSuccess(result.message || `${displayName} foi excluída.`);
      setShowDeleteDialog(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const config =
    statusOptions.find((option) => option.value === currentStatus) ??
    statusOptions[0];

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label={`Status de ${displayName}`}
        value={currentStatus}
        disabled={isSaving}
        onChange={(event) =>
          void handleStatusChange(event.target.value as StaffAccountStatus)
        }
        className={`rounded-full border px-3 py-1.5 text-xs font-bold outline-none transition disabled:opacity-50 ${config.className}`}
      >
        {statusOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-[#111115] text-white"
          >
            {option.label}
          </option>
        ))}
      </select>

      {canDelete && (
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowDeleteDialog(true);
          }}
          disabled={isDeleting}
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          Excluir
        </button>
      )}

      {error && <p className="max-w-[18rem] text-xs text-red-400">{error}</p>}

      {success && (
        <p className="max-w-[18rem] text-xs text-emerald-400">{success}</p>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#141118] p-6">
            <h2 className="text-lg font-bold text-white">
              Excluir {displayName} em definitivo?
            </h2>

            <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
              <p>
                A conta e o login são apagados. Esta ação não pode ser
                desfeita.
              </p>

              {assignedModels > 0 ? (
                <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200">
                  {assignedModels} modelo(s) estão atribuídas a esta conta e
                  ficarão <strong>sem representante</strong>. As modelos, notas
                  e o histórico continuam no sistema.
                </p>
              ) : (
                <p>Nenhuma modelo está atribuída a esta conta no momento.</p>
              )}

              <p>
                Prefere manter o histórico acessível? Escolha{" "}
                <strong>Arquivado</strong> no status: a conta perde o acesso,
                sai das listas ativas e pode ser restaurada depois.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-400 disabled:opacity-50"
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
