"use client";

import { useState, useTransition } from "react";

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
        Excluir Conta Permanentemente
      </button>

      {/*
        A page dialog rather than window.confirm: some mobile in-app browsers
        suppress the browser one, and a suppressed confirm returns false — so
        the button appears to do nothing at all.
      */}
      <ConfirmDialog
        open={open}
        title="Excluir esta conta em definitivo?"
        description={
          <p>
            O login e o perfil são apagados e a ação não pode ser desfeita. Os
            registros criados por esta conta permanecem, mas deixam de estar
            ligados a ela.
          </p>
        }
        detail={displayName}
        requirePhrase="EXCLUIR"
        confirmLabel="Excluir permanentemente"
        busyLabel="Excluindo..."
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
