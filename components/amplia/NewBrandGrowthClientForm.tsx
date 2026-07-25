"use client";

import { useActionState } from "react";

import {
  createBrandGrowthOnlyClientAction,
  type ClientActionState,
} from "@/app/amplia/clientes/actions";

const initialState: ClientActionState = { success: false, message: "" };

export default function NewBrandGrowthClientForm() {
  const [state, formAction, pending] = useActionState(
    createBrandGrowthOnlyClientAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Nome artístico" name="stageName" required />
      <Field
        label="Nome de exibição (se diferente do nome artístico)"
        name="displayName"
      />
      <Field label="Nome legal (privado, nunca enviado à IA sem consentimento)" name="legalName" />
      <Field
        label="Nicho principal"
        name="niche1"
        required
        placeholder="Ex: fitness, moda, viagem..."
      />

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
        {pending ? "Criando..." : "Criar cliente Brand Growth"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
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
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400"
      />
    </div>
  );
}
