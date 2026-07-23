"use client";

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
  return (
    <form
      action={() => action(targetId)}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Tem certeza de que deseja excluir permanentemente a conta de ${displayName}? Esta ação não pode ser desfeita e removerá o login e todos os dados de perfil desta conta.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-black"
      >
        Excluir Conta Permanentemente
      </button>
    </form>
  );
}
