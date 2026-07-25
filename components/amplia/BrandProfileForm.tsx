"use client";

import { useActionState } from "react";

import {
  updateBrandProfileAction,
  type DetailActionState,
} from "@/app/amplia/clientes/[talentId]/actions";
import type { BrandProfile } from "@/types/amplia";

const initialState: DetailActionState = { success: false, message: "" };

export default function BrandProfileForm({
  talentId,
  profile,
}: {
  talentId: string;
  profile: BrandProfile;
}) {
  const [state, formAction, pending] = useActionState(
    updateBrandProfileAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="talentId" value={talentId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Nicho 1"
          name="niche1"
          defaultValue={profile.niche1}
          required
        />
        <TextField label="Nicho 2" name="niche2" defaultValue={profile.niche2 ?? ""} />
        <TextField label="Nicho 3" name="niche3" defaultValue={profile.niche3 ?? ""} />
      </div>

      <TextArea
        label="Orientação permanente para a IA (voz, temas recorrentes, o que fazer/não fazer além dos limites)"
        name="aiGuidance"
        defaultValue={profile.aiGuidance ?? ""}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Posicionamento principal"
          name="primaryPositioning"
          defaultValue={profile.primaryPositioning ?? ""}
          placeholder="Ex: elegante, fitness, lifestyle..."
        />
        <TextField
          label="Voz de marca"
          name="brandVoice"
          defaultValue={profile.brandVoice ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Países-alvo (separados por vírgula)"
          name="targetCountries"
          defaultValue={profile.targetCountries.join(", ")}
        />
        <TextField
          label="Idiomas-alvo (separados por vírgula)"
          name="targetLanguages"
          defaultValue={profile.targetLanguages.join(", ")}
        />
      </div>

      <TextField
        label="Tópicos a evitar (separados por vírgula)"
        name="topicsToAvoid"
        defaultValue={profile.topicsToAvoid.join(", ")}
      />

      <div>
        <label
          htmlFor="status"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          Status do perfil
        </label>

        <select
          id="status"
          name="status"
          defaultValue={profile.status}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-purple-400"
        >
          <option value="draft">Rascunho</option>
          <option value="active">Ativo</option>
          <option value="archived">Arquivado</option>
        </select>
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
        {pending ? "Salvando..." : "Salvar perfil de marca"}
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
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
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400"
      />
    </div>
  );
}

function TextArea({
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

      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400"
      />
    </div>
  );
}
