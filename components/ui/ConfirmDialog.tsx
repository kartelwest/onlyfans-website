"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * The one confirmation dialog for destructive actions.
 *
 * It exists because `window.confirm` and `window.prompt` are not reliable: a
 * mobile in-app browser (Instagram, WhatsApp, an embedded WebView) may suppress
 * them outright, and a suppressed dialog returns false / null — so the action
 * is silently cancelled and the button looks broken. That is exactly what "the
 * Excluir button does not delete the note" turned out to be.
 *
 * It also gives what a browser dialog cannot: the record being removed shown in
 * place, a loading state, and a typed phrase for the irreversible ones.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy = false,
  requirePhrase,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  /** The record itself — the note body, the entry, the account name. */
  detail?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  /** When set, confirming stays disabled until this word is typed exactly. */
  requirePhrase?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("common.confirmDialog");
  const titleId = useId();
  const [phrase, setPhrase] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // A dialog reopened for a different record must not inherit the last typing.
  // Adjusted during render rather than in an effect — this is the state React
  // documents for "reset state when a prop changes", and it avoids the extra
  // render pass an effect would cost.
  if (wasOpen !== open) {
    setWasOpen(open);
    setPhrase("");
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  const phraseSatisfied = !requirePhrase || phrase.trim() === requirePhrase;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={() => {
        if (!busy) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-red-400/30 bg-[#141118] p-6 text-white"
      >
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>

        {description && (
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
            {description}
          </div>
        )}

        {detail && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">
            {detail}
          </div>
        )}

        {requirePhrase && (
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
              {t("typePhrase", { phrase: requirePhrase })}
            </span>

            <input
              autoFocus
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1f] px-4 py-3 text-sm outline-none focus:border-red-400/60 disabled:opacity-50"
            />
          </label>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-white/15 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 disabled:opacity-50"
          >
            {cancelLabel ?? t("cancel")}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !phraseSatisfied}
            className="rounded-xl bg-red-500 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? (busyLabel ?? t("busy"))
              : (confirmLabel ?? t("confirm"))}
          </button>
        </div>
      </div>
    </div>
  );
}
