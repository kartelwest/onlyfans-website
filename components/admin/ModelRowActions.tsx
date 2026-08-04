"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ModelRowActionsProps = {
  modelId: string;
  displayName: string;
};

export default function ModelRowActions({
  modelId,
  displayName,
}: ModelRowActionsProps) {
  const t = useTranslations("admin.models.delete");
  const tCommon = useTranslations("common.actions");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function clearMessages() {
    setError("");
    setSuccess("");
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
        throw new Error(result.error || t("failed"));
      }

      setSuccess(result.message || t("done", { name: displayName }));
      setShowDeleteDialog(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tErrors("generic"),
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
          onClick={() => {
            clearMessages();
            setShowDeleteDialog(true);
          }}
          disabled={isDeleting}
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {tCommon("delete")}
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
              {t("title")}
            </h3>

            <p className="mt-3 text-sm text-white/70">
              {t.rich("confirm", {
                name: displayName,
                strong: (chunks) => (
                  <span className="font-bold text-white">{chunks}</span>
                ),
              })}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                {tCommon("cancel")}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {isDeleting ? tCommon("deleting") : t("confirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
