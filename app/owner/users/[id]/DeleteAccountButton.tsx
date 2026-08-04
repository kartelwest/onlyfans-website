"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import ConfirmDialog from "@/components/ui/ConfirmDialog";

type DeleteAccountButtonProps = {
  targetId: string;
  displayName: string;
  action: (targetId: string) => Promise<void>;
};

export default function DeleteAccountButton({
  targetId,
  displayName,
  action,
}: DeleteAccountButtonProps) {
  const t = useTranslations("owner.deleteAccount");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-black disabled:opacity-50"
      >
        {t("button")}
      </button>

      {/*
        A page dialog rather than window.confirm: some mobile in-app browsers
        suppress the browser one, and a suppressed confirm returns false — so
        the button appears to do nothing at all.
      */}
      <ConfirmDialog
        open={open}
        title={t("title")}
        description={
          <p>{t("body")}</p>
        }
        detail={displayName}
        requirePhrase={t("confirmPhrase")}
        confirmLabel={t("confirm")}
        busyLabel={t("busy")}
        busy={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            await action(targetId);
            setOpen(false);
          })
        }
      />
    </>
  );
}
