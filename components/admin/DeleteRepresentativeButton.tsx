"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteRepresentative } from "@/app/admin/representatives/actions";

/**
 * "Excluir Rep" — permanent deletion of one representative account, from
 * wherever a representative is listed.
 *
 * Three things this button will not do:
 *
 *   1. Delete a representative who still holds models. Those models would be
 *      silently unassigned (models.representative_id is ON DELETE SET NULL),
 *      so the dialog says how many there are and sends you to reassign them
 *      first. The server action refuses the same case regardless of what the
 *      UI shows.
 *   2. Fire twice. The button and the dialog's confirm are both disabled while
 *      the action is in flight, and the dialog closes only on success.
 *   3. Delete without saying what is being deleted. The representative's name
 *      is in the dialog, and the confirmation phrase has to be typed out. That
 *      phrase is NOT translated: it is matched verbatim by the server action,
 *      so it has to be the same string whatever language the admin reads in.
 *
 * Deletion is the owner's alone. That is enforced by the server action, by the
 * profiles_delete RLS policy, and by only rendering this button for an owner.
 */
export default function DeleteRepresentativeButton({
  representativeId,
  representativeName,
  assignedModelCount,
  profileHref,
  className,
}: {
  representativeId: string;
  representativeName: string;
  /** Models still pointing at this representative. Zero to allow deletion. */
  assignedModelCount: number;
  /** Where to go to reassign the models — the representative's profile. */
  profileHref: string;
  className?: string;
}) {
  const t = useTranslations("admin.representatives.delete");
  const tCommon = useTranslations("common.actions");

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Kept as {text, ok} rather than sniffing the text for a Portuguese word.
  // The old code coloured the line by testing message.includes("excluído"),
  // which silently turns every success red the moment the server answers in
  // another language.
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const displayName = representativeName.trim() || t("unnamed");
  const blocked = assignedModelCount > 0;

  function handleConfirm() {
    if (blocked || busy) {
      return;
    }

    const formData = new FormData();
    formData.set("representativeId", representativeId);
    formData.set("confirmation", "EXCLUIR");

    setBusy(true);

    startTransition(async () => {
      const outcome = await deleteRepresentative(null, formData);

      setBusy(false);
      setResult({ text: outcome.message, ok: outcome.success });

      if (outcome.success) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending || busy}
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className={
          className ??
          "rounded-lg border border-red-600/40 bg-red-500/10 px-4 py-2 text-center text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        {t("button")}
      </button>

      {result && (
        <p
          className={`mt-2 text-xs leading-5 ${
            result.ok ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {result.text}
        </p>
      )}

      <ConfirmDialog
        open={open}
        title={blocked ? t("blockedTitle") : t("title")}
        description={
          blocked ? (
            <>
              <p>
                {t.rich("blockedBody", {
                  name: displayName,
                  count: assignedModelCount,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>

              <p>{t("blockedAction")}</p>

              <Link
                href={profileHref}
                className="inline-block font-bold text-pink-300 underline transition hover:text-pink-200"
              >
                {t("openProfile")}
              </Link>
            </>
          ) : (
            <>
              <p>{t("bodyPermanent")}</p>

              <p>
                {t.rich("bodyArchive", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>

              <p>{t("bodyAudit")}</p>
            </>
          )
        }
        detail={displayName}
        requirePhrase={blocked ? undefined : "EXCLUIR"}
        confirmLabel={blocked ? t("understood") : t("confirmButton")}
        cancelLabel={blocked ? tCommon("close") : tCommon("cancel")}
        busyLabel={tCommon("deleting")}
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setOpen(false);
          }
        }}
        onConfirm={() => {
          if (blocked) {
            setOpen(false);
            return;
          }

          handleConfirm();
        }}
      />
    </>
  );
}
