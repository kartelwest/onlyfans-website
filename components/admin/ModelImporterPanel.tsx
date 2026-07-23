"use client";

import { ChangeEvent, useState } from "react";

type EditableModel = {
  display_name: string;
  stage_name: string;
  birthday: string;
  city: string;
  state: string;
  country: string;
  whatsapp: string;
  email: string;
  instagram: string;
  twitter: string;
  notes: string;
};

type ExtractResponse = {
  models?: Partial<EditableModel>[];
  clarification_needed?: string | null;
  error?: string;
};

type ConfirmResult = {
  index: number;
  ok: boolean;
  id?: string;
  slug?: string;
  display_name: string;
  error?: string;
};

type ConfirmResponse = {
  results?: ConfirmResult[];
  error?: string;
};

const EMPTY_MODEL: EditableModel = {
  display_name: "",
  stage_name: "",
  birthday: "",
  city: "",
  state: "",
  country: "",
  whatsapp: "",
  email: "",
  instagram: "",
  twitter: "",
  notes: "",
};

function toEditableModel(input: Partial<EditableModel>): EditableModel {
  return { ...EMPTY_MODEL, ...input };
}

export default function ModelImporterPanel({
  initialAutoSave,
  isOwner,
}: {
  initialAutoSave: boolean;
  isOwner: boolean;
}) {
  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const [clarification, setClarification] = useState<string | null>(null);
  const [models, setModels] = useState<EditableModel[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveResult, setSaveResult] = useState<ConfirmResponse | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setExtractError("");
    setClarification(null);
    setModels([]);
    setSaveResult(null);
    setSaveError("");
  }

  async function handleToggleAutoSave() {
    if (!isOwner || isSavingSetting) {
      return;
    }

    const nextValue = !autoSave;
    setIsSavingSetting(true);

    try {
      const response = await fetch("/api/admin/importer-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSave: nextValue }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar a configuração.");
      }

      setAutoSave(nextValue);
    } catch (error) {
      setExtractError(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsSavingSetting(false);
    }
  }

  async function handleExtract() {
    if (!file || isExtracting) {
      return;
    }

    setIsExtracting(true);
    setExtractError("");
    setClarification(null);
    setModels([]);
    setSaveResult(null);
    setSaveError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/import/extract", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as ExtractResponse;

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível ler o arquivo.");
      }

      const extractedModels = (result.models ?? []).map(toEditableModel);

      setClarification(result.clarification_needed ?? null);
      setModels(extractedModels);

      if (autoSave && extractedModels.length > 0) {
        await handleSave(extractedModels);
      }
    } catch (error) {
      setExtractError(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function updateModelField(
    index: number,
    field: keyof EditableModel,
    value: string,
  ) {
    setModels((current) =>
      current.map((model, i) =>
        i === index ? { ...model, [field]: value } : model,
      ),
    );
  }

  function removeModel(index: number) {
    setModels((current) => current.filter((_, i) => i !== index));
  }

  function addBlankModel() {
    setModels((current) => [...current, { ...EMPTY_MODEL }]);
  }

  async function handleSave(modelsToSave: EditableModel[] = models) {
    if (modelsToSave.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveResult(null);

    try {
      const response = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: modelsToSave }),
      });

      const result = (await response.json()) as ConfirmResponse;

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar as modelos.");
      }

      setSaveResult(result);

      const savedIndexes = new Set(
        (result.results ?? []).filter((r) => r.ok).map((r) => r.index),
      );

      setModels((current) =>
        current.filter((_, index) => !savedIndexes.has(index)),
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#111115] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-white">
            Salvar automaticamente
          </p>
          <p className="mt-1 text-xs text-white/50">
            {autoSave
              ? "Ligado: os dados extraídos são salvos direto como candidatas, sem revisão."
              : "Desligado (padrão): você revisa e corrige os dados antes de salvar."}
            {!isOwner && " Apenas o proprietário pode alterar isso."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleAutoSave}
          disabled={!isOwner || isSavingSetting}
          className={`shrink-0 rounded-full border px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
            autoSave
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
              : "border-white/15 bg-white/5 text-white/60"
          }`}
        >
          {autoSave ? "Ligado" : "Desligado"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <p className="text-sm font-bold text-white">Arquivo</p>

        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="mt-3 block w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-pink-400"
        />

        <button
          type="button"
          onClick={handleExtract}
          disabled={!file || isExtracting}
          className="mt-4 rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExtracting ? "Analisando arquivo..." : "Extrair dados"}
        </button>

        {extractError && (
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {extractError}
          </p>
        )}
      </div>

      {clarification && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-6">
          <p className="text-sm font-bold text-yellow-200">
            O assistente precisa de esclarecimento
          </p>
          <p className="mt-2 text-sm leading-6 text-yellow-100/80">
            {clarification}
          </p>
        </div>
      )}

      {models.length > 0 && (
        <div className="space-y-5">
          {models.map((model, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-[#111115] p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">
                  Modelo {index + 1}
                </p>

                <button
                  type="button"
                  onClick={() => removeModel(index)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Remover
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome completo"
                  value={model.display_name}
                  onChange={(value) =>
                    updateModelField(index, "display_name", value)
                  }
                  required
                />
                <Field
                  label="Nome artístico"
                  value={model.stage_name}
                  onChange={(value) =>
                    updateModelField(index, "stage_name", value)
                  }
                />
                <Field
                  label="Data de nascimento"
                  value={model.birthday}
                  onChange={(value) =>
                    updateModelField(index, "birthday", value)
                  }
                  placeholder="YYYY-MM-DD"
                />
                <Field
                  label="Cidade"
                  value={model.city}
                  onChange={(value) => updateModelField(index, "city", value)}
                />
                <Field
                  label="Estado"
                  value={model.state}
                  onChange={(value) => updateModelField(index, "state", value)}
                />
                <Field
                  label="País"
                  value={model.country}
                  onChange={(value) =>
                    updateModelField(index, "country", value)
                  }
                />
                <Field
                  label="WhatsApp"
                  value={model.whatsapp}
                  onChange={(value) =>
                    updateModelField(index, "whatsapp", value)
                  }
                />
                <Field
                  label="E-mail"
                  value={model.email}
                  onChange={(value) => updateModelField(index, "email", value)}
                />
                <Field
                  label="Instagram"
                  value={model.instagram}
                  onChange={(value) =>
                    updateModelField(index, "instagram", value)
                  }
                />
                <Field
                  label="X / Twitter"
                  value={model.twitter}
                  onChange={(value) =>
                    updateModelField(index, "twitter", value)
                  }
                />
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
                  Notas
                </span>
                <textarea
                  rows={3}
                  value={model.notes}
                  onChange={(event) =>
                    updateModelField(index, "notes", event.target.value)
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
                />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addBlankModel}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              + Adicionar modelo em branco
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Salvando..."
                : `Salvar ${models.length > 1 ? `${models.length} modelos` : "modelo"} como candidata(s)`}
            </button>
          </div>

          {saveError && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
              {saveError}
            </p>
          )}
        </div>
      )}

      {saveResult && (
        <div className="space-y-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6">
          {(saveResult.results ?? []).map((result) =>
            result.ok ? (
              <p
                key={result.index}
                className="text-sm font-semibold text-emerald-300"
              >
                ✓ {result.display_name} salva como candidata ({"/admin/models/"}
                {result.slug})
              </p>
            ) : (
              <p
                key={result.index}
                className="text-sm font-semibold text-red-300"
              >
                ✗ {result.display_name}: {result.error}
              </p>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
        {label}
        {required && " *"}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
      />
    </label>
  );
}
