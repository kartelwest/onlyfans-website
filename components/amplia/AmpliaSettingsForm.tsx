"use client";

import { useActionState } from "react";

import {
  updateAmpliaSettingsAction,
  type SettingsState,
} from "@/app/amplia/configuracoes/actions";
import type { AmpliaConfig } from "@/lib/amplia/config";

const initialState: SettingsState = { success: false, message: "" };

export default function AmpliaSettingsForm({
  config,
  canEdit,
}: {
  config: AmpliaConfig;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateAmpliaSettingsAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label
          htmlFor="displayName"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          Nome de exibição (menu, títulos)
        </label>

        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          disabled={!canEdit}
          defaultValue={config.displayName}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div>
        <label
          htmlFor="moduleCodeName"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          Nome interno do módulo (código, logs, auditoria)
        </label>

        <input
          id="moduleCodeName"
          name="moduleCodeName"
          type="text"
          required
          disabled={!canEdit}
          defaultValue={config.moduleCodeName}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <input
          id="featureXEnabled"
          name="featureXEnabled"
          type="checkbox"
          disabled={!canEdit}
          defaultChecked={config.featureXEnabled}
          className="mt-1 h-4 w-4 rounded border-white/30 bg-black/30 disabled:cursor-not-allowed"
        />

        <label htmlFor="featureXEnabled" className="text-sm text-white/80">
          <span className="font-semibold">
            Ativar publicação automática via API do X
          </span>

          <p className="mt-1 text-xs text-white/50">
            Mantenha desativado até que a conta de desenvolvedor do X esteja
            configurada e os créditos pré-pagos carregados. O playbook manual
            do X e a geração de conteúdo continuam funcionando
            independentemente desta chave.
          </p>
        </label>
      </div>

      {!canEdit && (
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-yellow-300/80">
          Somente o proprietário pode alterar estas configurações.
        </p>
      )}

      {state.message && (
        <p
          className={`text-sm font-semibold ${
            state.success ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      {canEdit && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-purple-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar configurações"}
        </button>
      )}
    </form>
  );
}
