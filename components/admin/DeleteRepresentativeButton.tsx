"use client";

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
 *      is in the dialog, and "EXCLUIR" has to be typed out.
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const displayName = representativeName.trim() || "sem nome";
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
      const result = await deleteRepresentative(null, formData);

      setBusy(false);
      setMessage(result.message);

      if (result.success) {
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
          setMessage(null);
          setOpen(true);
        }}
        className={
          className ??
          "rounded-lg border border-red-600/40 bg-red-500/10 px-4 py-2 text-center text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        Excluir Rep
      </button>

      {message && (
        <p
          className={`mt-2 text-xs leading-5 ${
            message.includes("excluído")
              ? "text-emerald-300"
              : "text-red-300"
          }`}
        >
          {message}
        </p>
      )}

      <ConfirmDialog
        open={open}
        title={
          blocked
            ? "Reatribua as modelos antes de excluir"
            : "Excluir este representante em definitivo?"
        }
        description={
          blocked ? (
            <>
              <p>
                {displayName} ainda tem{" "}
                <strong>
                  {assignedModelCount} modelo
                  {assignedModelCount === 1 ? "" : "s"} atribuída
                  {assignedModelCount === 1 ? "" : "s"}
                </strong>
                . Excluir a conta agora deixaria{" "}
                {assignedModelCount === 1 ? "essa modelo" : "essas modelos"} sem
                representante, sem nada na tela dizendo isso.
              </p>

              <p>
                Abra o perfil dele, reatribua as modelos a outro representante e
                volte aqui.
              </p>

              <Link
                href={profileHref}
                className="inline-block font-bold text-pink-300 underline transition hover:text-pink-200"
              >
                Abrir o perfil do representante →
              </Link>
            </>
          ) : (
            <>
              <p>
                A conta e o login são apagados em definitivo e a ação não pode
                ser desfeita. Nenhuma modelo está atribuída a este
                representante, então nada fica sem responsável.
              </p>

              <p>
                Prefere manter o histórico acessível? Use{" "}
                <strong>Arquivar</strong> na tela de representantes: a conta
                perde o acesso, sai das listas ativas e pode voltar depois.
              </p>

              <p>
                A exclusão fica registrada no histórico do sistema com o nome do
                representante, quem excluiu e a data e hora.
              </p>
            </>
          )
        }
        detail={displayName}
        requirePhrase={blocked ? undefined : "EXCLUIR"}
        confirmLabel={blocked ? "Entendi" : "Excluir permanentemente"}
        cancelLabel={blocked ? "Fechar" : "Cancelar"}
        busyLabel="Excluindo..."
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
