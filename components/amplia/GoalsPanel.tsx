"use client";

import { useActionState } from "react";

import {
  createGrowthGoalAction,
  type DetailActionState,
} from "@/app/amplia/clientes/[talentId]/actions";
import type { GrowthGoal } from "@/types/amplia";

const initialState: DetailActionState = { success: false, message: "" };

export default function GoalsPanel({
  talentId,
  goals,
}: {
  talentId: string;
  goals: GrowthGoal[];
}) {
  const [state, formAction, pending] = useActionState(
    createGrowthGoalAction,
    initialState,
  );

  return (
    <div className="space-y-6">
      {goals.length === 0 ? (
        <p className="text-sm text-white/50">Nenhum objetivo cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {goal.objective}{" "}
                  <span className="text-xs font-normal text-white/45">
                    ({goal.platform ?? "ambas as plataformas"})
                  </span>
                </p>

                <p className="mt-1 text-xs text-white/50">
                  {goal.startValue ?? "—"} → {goal.targetValue ?? "—"}
                  {goal.targetDate ? ` até ${goal.targetDate}` : ""}
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase text-white/60">
                {goal.priority}
              </span>
            </div>
          ))}
        </div>
      )}

      <form
        action={formAction}
        className="grid gap-3 rounded-xl border border-dashed border-white/15 p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="talentId" value={talentId} />

        <input
          name="objective"
          type="text"
          required
          placeholder="Objetivo (ex: seguidores, engajamento)"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        />

        <select
          name="platform"
          defaultValue=""
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        >
          <option value="">Ambas as plataformas</option>
          <option value="instagram">Instagram</option>
          <option value="x">X</option>
        </select>

        <input
          name="startValue"
          type="number"
          placeholder="Valor inicial"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        />

        <input
          name="targetValue"
          type="number"
          placeholder="Valor-alvo"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        />

        <input
          name="targetDate"
          type="date"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        />

        <select
          name="priority"
          defaultValue="medium"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"
        >
          <option value="low">Baixa prioridade</option>
          <option value="medium">Média prioridade</option>
          <option value="high">Alta prioridade</option>
        </select>

        <input
          name="measurementMethod"
          type="text"
          placeholder="Como será medido"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 sm:col-span-2"
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
        >
          {pending ? "Criando..." : "Adicionar objetivo"}
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
