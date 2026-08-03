"use client";

import { useActionState } from "react";

import {
  reassignRepresentative,
  type ReassignState,
} from "@/app/admin/models/[slug]/actions";

type RepresentativeOption = {
  id: string;
  fullName: string;
  role: string;
};

type ReassignRepresentativePanelProps = {
  modelId: string;
  modelSlug: string;
  currentRepresentativeId: string | null;
  representatives: RepresentativeOption[];
  isOwner: boolean;
};

const initialState: ReassignState = {
  success: false,
  message: "",
};

export default function ReassignRepresentativePanel({
  modelId,
  currentRepresentativeId,
  representatives,
  isOwner,
}: ReassignRepresentativePanelProps) {
  const [state, formAction, pending] = useActionState(
    reassignRepresentative,
    initialState,
  );

  if (!isOwner) {
    return null;
  }

  const options = representatives.filter(
    (rep) =>
      rep.role === "owner" ||
      rep.role === "administrator" ||
      rep.role === "representative",
  );

  const current = options.find(
    (rep) => rep.id === currentRepresentativeId,
  );

  return (
    <form action={formAction} className="rounded-2xl border border-white/10 bg-black/30 p-6">
      <h3 className="text-base font-bold text-white/90">
        Representante / responsável
      </h3>

      <p className="mt-2 text-sm text-white/50">
        Responsável atual: {" "}
        <span className="font-medium text-white/80">
          {current?.fullName || "Nenhum"}
          {current && current.role === "owner"
            ? " (Proprietário)"
            : current && current.role === "administrator"
              ? " (Administrador)"
              : current && current.role === "representative"
                ? " (Representante)"
                : ""}
        </span>
      </p>

      <input type="hidden" name="modelId" value={modelId} />

      <label htmlFor="representativeId" className="sr-only">
        Novo representante
      </label>

      <select
        id="representativeId"
        name="representativeId"
        required
        defaultValue={currentRepresentativeId ?? ""}
        className="mt-5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-pink-400"
      >
        <option value="">Selecione um novo responsável</option>

        {options.map((rep) => (
          <option key={rep.id} value={rep.id}>
            {rep.fullName}
            {rep.role === "owner"
              ? " (Proprietário)"
              : rep.role === "administrator"
                ? " (Administrador)"
                : " (Representante)"}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-40"
      >
        {pending ? "Salvando..." : "Reatribuir representante"}
      </button>

      {state.message && (
        <p
          className={`mt-4 text-sm ${
            state.success ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
