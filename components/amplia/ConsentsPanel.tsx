"use client";

import { useActionState } from "react";

import {
  recordConsentAction,
  type DetailActionState,
} from "@/app/amplia/clientes/[talentId]/actions";
import { CONSENT_TYPES, type ConsentType } from "@/types/amplia";

const initialState: DetailActionState = { success: false, message: "" };

type ConsentStatusRow = {
  consent_type: ConsentType;
  granted: boolean;
  effective_date: string;
  notes: string | null;
};

export default function ConsentsPanel({
  talentId,
  currentStatus,
}: {
  talentId: string;
  currentStatus: ConsentStatusRow[];
}) {
  const [state, formAction, pending] = useActionState(
    recordConsentAction,
    initialState,
  );

  const statusByType = new Map(
    currentStatus.map((row) => [row.consent_type, row]),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        {CONSENT_TYPES.map(({ value, label }) => {
          const status = statusByType.get(value);

          return (
            <div
              key={value}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <span className="text-xs text-white/70">{label}</span>

              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${
                  status?.granted
                    ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                    : status
                      ? "bg-red-500/10 text-red-300 ring-red-500/30"
                      : "bg-white/5 text-white/40 ring-white/15"
                }`}
              >
                {status?.granted
                  ? `Concedido (${status.effective_date})`
                  : status
                    ? `Revogado (${status.effective_date})`
                    : "Não registrado"}
              </span>
            </div>
          );
        })}
      </div>

      <form
        action={formAction}
        className="grid gap-3 rounded-xl border border-dashed border-white/15 p-4 sm:grid-cols-[1fr_auto_auto]"
      >
        <input type="hidden" name="talentId" value={talentId} />

        <select
          name="consentType"
          required
          defaultValue=""
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        >
          <option value="" disabled>
            Tipo de consentimento...
          </option>

          {CONSENT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          name="granted"
          defaultValue="granted"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        >
          <option value="granted">Conceder</option>
          <option value="revoked">Revogar</option>
        </select>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Registrar"}
        </button>
      </form>

      {state.message && (
        <p
          className={`text-sm font-semibold ${
            state.success ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
