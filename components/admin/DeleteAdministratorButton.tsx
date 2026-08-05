"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteAdministrator } from "@/app/admin/administrators/actions";

/**
 * Permanent deletion of one administrator account, from the list where
 * administrators are actually looked at.
 *
 * The twin of DeleteRepresentativeButton, deliberately: the two accounts carry
 * comparable power, and until now one had a red Delete button on its row while
 * the other had a neutral "Manage account" link leading somewhere else. Same
 * capability, two presentations — which reads as a permission that was never
 * granted.
 *
 * The refusals are the same three, and none of them live only here:
 *
 *   1. An administrator who still holds models is not deleted.
 *      models.representative_id is ON DELETE SET NULL and an administrator can
 *      be assigned models exactly like a representative, so deleting her would
 *      silently unassign them. The dialog says how many and sends the owner to
 *      reassign first; the server action refuses the same case regardless of
 *      what this component renders.
 *   2. It will not fire twice — button and confirm are both disabled in
 *      flight, and the dialog closes only on success.
 *   3. It will not delete anything unnamed. The account's name is in the
 *      dialog and the confirmation phrase must be typed out.
 *
 * That typed phrase is localised; the value sent to the server is a fixed
 * literal, so the two never have to agree across languages.
 *
 * Deletion is the owner's alone — enforced by the server action, by the
 * profiles_delete RLS policy, and by only rendering this button for an owner.
 * The owner's own row never gets one: the action refuses a target that is not
 * an administrator, which is what keeps an owner from deleting themselves.
 */
export default function DeleteAdministratorButton({
  administratorId,
  administratorName,
  assignedModelCount,
  profileHref,
  className,
}: {
  administratorId: string;
  administratorName: string;
  /** Models still pointing at this administrator. Zero to allow deletion. */
  assignedModelCount: number;
  /** Where to go to reassign the models. */
  profileHref: string;
  className?: string;
}) {
  const t = useTranslations("admin.administrators.delete");
  const tCommon = useTranslations("common.actions");

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const displayName = administratorName.trim() || t("unnamed");
  const blocked = assignedModelCount > 0;

  function handleConfirm() {
    if (blocked || busy) {
      return;
    }

    const formData = new FormData();
    formData.set("administratorId", administratorId);
    // The wire value the server action checks — a protocol constant, not the
    // phrase the owner types (that one is localised, see requirePhrase below).
    formData.set("confirmation", "EXCLUIR");

    setBusy(true);

    startTransition(async () => {
      const outcome = await deleteAdministrator(null, formData);

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
                {t("openModels")}
              </Link>
            </>
          ) : (
            <>
              <p>{t("bodyPermanent")}</p>

              <p>
                {t.rich("bodyDemote", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>

              <p>{t("bodyAudit")}</p>
            </>
          )
        }
        detail={displayName}
        requirePhrase={blocked ? undefined : t("confirmPhrase")}
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
