"use client";

import { useActionState } from "react";

import {
  upsertBoundariesAction,
  type DetailActionState,
} from "@/app/amplia/clientes/[talentId]/actions";
import type { ClientBoundaries } from "@/types/amplia";

const initialState: DetailActionState = { success: false, message: "" };

export default function BoundariesForm({
  talentId,
  boundaries,
}: {
  talentId: string;
  boundaries: ClientBoundaries | null;
}) {
  const [state, formAction, pending] = useActionState(
    upsertBoundariesAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="talentId" value={talentId} />

      <TextField
        label="Assuntos proibidos (separados por vírgula)"
        name="prohibitedSubjects"
        defaultValue={boundaries?.prohibitedSubjects.join(", ") ?? ""}
      />
      <TextField
        label="Palavras proibidas (separadas por vírgula)"
        name="prohibitedWords"
        defaultValue={boundaries?.prohibitedWords.join(", ") ?? ""}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Limite político"
          name="politicalBoundary"
          defaultValue={boundaries?.politicalBoundary ?? ""}
        />
        <TextField
          label="Limite sexual/roupas"
          name="sexualBoundary"
          defaultValue={boundaries?.sexualBoundary ?? ""}
        />
        <TextField
          label="Limite de comentários"
          name="commentBoundary"
          defaultValue={boundaries?.commentBoundary ?? ""}
        />
        <TextField
          label="Limite de DMs"
          name="dmBoundary"
          defaultValue={boundaries?.dmBoundary ?? ""}
        />
      </div>

      <TextField
        label="Contas que nunca devem ser mencionadas (separadas por vírgula)"
        name="accountsNotToMention"
        defaultValue={boundaries?.accountsNotToMention.join(", ") ?? ""}
      />
      <TextField
        label="Detalhes privados que nunca devem ser revelados (separados por vírgula)"
        name="privateDetailsNeverReveal"
        defaultValue={boundaries?.privateDetailsNeverReveal.join(", ") ?? ""}
      />
      <TextField
        label="Tópicos de crise que exigem revisão humana (separados por vírgula)"
        name="crisisTopics"
        defaultValue={boundaries?.crisisTopics.join(", ") ?? ""}
      />

      {state.message && (
        <p
          className={`text-sm font-semibold ${
            state.success ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar limites"}
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold text-white/80"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400"
      />
    </div>
  );
}
