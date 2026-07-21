"use client";

import { useActionState } from "react";

import {
  createUserAction,
  type CreateUserState,
} from "./actions";

type UserRole = "model" | "administrator" | "representative";

type NewUserFormProps = {
  role: UserRole;
};

const initialState: CreateUserState = {
  success: false,
  message: "",
};

export default function NewUserForm({
  role,
}: NewUserFormProps) {
  const [state, formAction, pending] = useActionState(
    createUserAction,
    initialState,
  );

  const isModel = role === "model";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="role" value={role} />

      <div>
        <label
          htmlFor="fullName"
          className="mb-2 block text-sm font-semibold text-zinc-200"
        >
          Nome completo
        </label>

        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
          placeholder="Digite o nome completo"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-semibold text-zinc-200"
        >
          E-mail
        </label>

        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
          placeholder="nome@exemplo.com"
        />
      </div>

      {isModel && (
        <div>
          <label
            htmlFor="whatsapp"
            className="mb-2 block text-sm font-semibold text-zinc-200"
          >
            WhatsApp
          </label>

          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
            placeholder="+55 21 99999-9999"
          />

          <p className="mt-2 text-xs text-zinc-500">
            A senha temporária será formada pelo último sobrenome
            e pelos quatro últimos números do WhatsApp.
          </p>
        </div>
      )}

      {!isModel && (
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-semibold text-zinc-200"
          >
            Senha temporária
          </label>

          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={6}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
            placeholder="Digite uma senha temporária"
          />
        </div>
      )}

      {state.message && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            state.success
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <p className="font-semibold">{state.message}</p>

          {state.success && state.temporaryPassword && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wider text-green-200/70">
                Senha temporária
              </p>

              <p className="mt-1 text-lg font-bold">
                {state.temporaryPassword}
              </p>

              <p className="mt-2 text-xs text-green-200/70">
                Guarde esta senha antes de sair da página.
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-pink-400 px-5 py-3 font-bold text-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}