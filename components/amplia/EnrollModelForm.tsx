"use client";

import { useActionState } from "react";

import {
  enrollExistingModelAction,
  type ClientActionState,
} from "@/app/amplia/clientes/actions";

const initialState: ClientActionState = { success: false, message: "" };

export default function EnrollModelForm({
  eligibleModels,
}: {
  eligibleModels: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    enrollExistingModelAction,
    initialState,
  );

  if (eligibleModels.length === 0) {
    return (
      <p className="text-sm text-white/50">
        Todas as modelos ativas já estão inscritas no Brand Growth, ou não há
        modelos cadastradas ainda.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="modelId"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          Modelo (OnlyFans)
        </label>

        <select
          id="modelId"
          name="modelId"
          required
          defaultValue=""
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-purple-400"
        >
          <option value="" disabled>
            Selecione...
          </option>

          {eligibleModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="niche1"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          Nicho principal
        </label>

        <input
          id="niche1"
          name="niche1"
          type="text"
          required
          placeholder="Ex: fitness, moda, viagem..."
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" name="instagram" className="h-4 w-4" />
          Instagram
        </label>

        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" name="x" className="h-4 w-4" />X (playbook manual)
        </label>
      </div>

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
        {pending ? "Inscrevendo..." : "Inscrever no Brand Growth"}
      </button>
    </form>
  );
}
