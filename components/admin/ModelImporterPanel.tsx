"use client";

import { ChangeEvent, useState } from "react";

type EditableApplicant = {
  nomeCompleto: string;
  nomeArtisticoDesejado: string;
  dataNascimento: string;
  cidade: string;
  estado: string;
  pais: string;
  whatsapp: string;
  email: string;
  instagram: string;
  twitter: string;
  representanteIndicacao: string;
  possuiOnlyfans: string;
  bloquearBrasil: string;
  mostrarRosto: string;
  moedaPreferida: string;
  frequenciaConteudo: string;
  motivoCandidatura: string;
};

type ExtractResponse = {
  applicants?: Partial<EditableApplicant>[];
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

const EMPTY_APPLICANT: EditableApplicant = {
  nomeCompleto: "",
  nomeArtisticoDesejado: "",
  dataNascimento: "",
  cidade: "",
  estado: "",
  pais: "",
  whatsapp: "",
  email: "",
  instagram: "",
  twitter: "",
  representanteIndicacao: "",
  possuiOnlyfans: "",
  bloquearBrasil: "",
  mostrarRosto: "",
  moedaPreferida: "",
  frequenciaConteudo: "",
  motivoCandidatura: "",
};

const MAX_FILES = 6;

function toEditableApplicant(
  input: Partial<EditableApplicant>,
): EditableApplicant {
  return { ...EMPTY_APPLICANT, ...input };
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

  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const [clarification, setClarification] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<EditableApplicant[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveResult, setSaveResult] = useState<ConfirmResponse | null>(null);

  function resetResults() {
    setExtractError("");
    setClarification(null);
    setApplicants([]);
    setSaveResult(null);
    setSaveError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);

    if (selected.length > MAX_FILES) {
      setExtractError(`Envie no máximo ${MAX_FILES} arquivos por vez.`);
      setFiles(selected.slice(0, MAX_FILES));
    } else {
      setExtractError("");
      setFiles(selected);
    }

    setClarification(null);
    setApplicants([]);
    setSaveResult(null);
    setSaveError("");
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
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
    if (files.length === 0 || files.length > MAX_FILES || isExtracting) {
      return;
    }

    setIsExtracting(true);
    resetResults();

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/admin/import/extract", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as ExtractResponse;

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível ler os arquivos.");
      }

      const extractedApplicants = (result.applicants ?? []).map(
        toEditableApplicant,
      );

      setClarification(result.clarification_needed ?? null);
      setApplicants(extractedApplicants);

      if (autoSave && extractedApplicants.length > 0) {
        await handleSave(extractedApplicants);
      }
    } catch (error) {
      setExtractError(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function updateApplicantField(
    index: number,
    field: keyof EditableApplicant,
    value: string,
  ) {
    setApplicants((current) =>
      current.map((applicant, i) =>
        i === index ? { ...applicant, [field]: value } : applicant,
      ),
    );
  }

  function removeApplicant(index: number) {
    setApplicants((current) => current.filter((_, i) => i !== index));
  }

  function addBlankApplicant() {
    setApplicants((current) => [...current, { ...EMPTY_APPLICANT }]);
  }

  async function handleSave(
    applicantsToSave: EditableApplicant[] = applicants,
  ) {
    if (applicantsToSave.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveResult(null);

    try {
      const response = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicants: applicantsToSave }),
      });

      const result = (await response.json()) as ConfirmResponse;

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar as candidatas.");
      }

      setSaveResult(result);

      const savedIndexes = new Set(
        (result.results ?? []).filter((r) => r.ok).map((r) => r.index),
      );

      setApplicants((current) =>
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
        <p className="text-sm font-bold text-white">Arquivos</p>
        <p className="mt-1 text-xs text-white/50">
          Envie de 1 a {MAX_FILES} arquivos (PDF, JPG, PNG ou WEBP). Se forem
          vários prints de uma mesma conversa, envie todos juntos — serão
          tratados como uma única candidata.
        </p>

        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="mt-3 block w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-pink-400"
        />

        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#08080a] px-4 py-2 text-sm text-white/70"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-3 shrink-0 text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={handleExtract}
          disabled={files.length === 0 || files.length > MAX_FILES || isExtracting}
          className="mt-4 rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExtracting ? "Analisando arquivos..." : "Extrair dados"}
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

      {applicants.length > 0 && (
        <div className="space-y-5">
          {applicants.map((applicant, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-[#111115] p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">
                  Candidata {index + 1}
                </p>

                <button
                  type="button"
                  onClick={() => removeApplicant(index)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Remover
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome completo"
                  value={applicant.nomeCompleto}
                  onChange={(value) =>
                    updateApplicantField(index, "nomeCompleto", value)
                  }
                  required
                />
                <Field
                  label="Nome artístico desejado"
                  value={applicant.nomeArtisticoDesejado}
                  onChange={(value) =>
                    updateApplicantField(index, "nomeArtisticoDesejado", value)
                  }
                />
                <Field
                  label="Data de nascimento"
                  value={applicant.dataNascimento}
                  onChange={(value) =>
                    updateApplicantField(index, "dataNascimento", value)
                  }
                  placeholder="AAAA-MM-DD"
                />
                <Field
                  label="Cidade"
                  value={applicant.cidade}
                  onChange={(value) =>
                    updateApplicantField(index, "cidade", value)
                  }
                />
                <Field
                  label="Estado"
                  value={applicant.estado}
                  onChange={(value) =>
                    updateApplicantField(index, "estado", value)
                  }
                />
                <Field
                  label="País"
                  value={applicant.pais}
                  onChange={(value) =>
                    updateApplicantField(index, "pais", value)
                  }
                />
                <Field
                  label="WhatsApp"
                  value={applicant.whatsapp}
                  onChange={(value) =>
                    updateApplicantField(index, "whatsapp", value)
                  }
                />
                <Field
                  label="E-mail"
                  value={applicant.email}
                  onChange={(value) =>
                    updateApplicantField(index, "email", value)
                  }
                />
                <Field
                  label="Instagram"
                  value={applicant.instagram}
                  onChange={(value) =>
                    updateApplicantField(index, "instagram", value)
                  }
                />
                <Field
                  label="X / Twitter"
                  value={applicant.twitter}
                  onChange={(value) =>
                    updateApplicantField(index, "twitter", value)
                  }
                />

                <SelectField
                  label="Quem indicou"
                  value={applicant.representanteIndicacao}
                  onChange={(value) =>
                    updateApplicantField(index, "representanteIndicacao", value)
                  }
                  options={[
                    { value: "", label: "Não identificado" },
                    { value: "Kartel", label: "Kartel" },
                    { value: "Rayssa", label: "Rayssa" },
                    { value: "Antonio (Tony)", label: "Antonio (Tony)" },
                    { value: "Boca a boca", label: "Boca a boca" },
                  ]}
                />

                <SelectField
                  label="Já possui OnlyFans"
                  value={applicant.possuiOnlyfans}
                  onChange={(value) =>
                    updateApplicantField(index, "possuiOnlyfans", value)
                  }
                  options={[
                    { value: "", label: "Não identificado" },
                    { value: "sim", label: "Sim" },
                    { value: "nao", label: "Não" },
                  ]}
                />

                <SelectField
                  label="Deseja bloquear o Brasil"
                  value={applicant.bloquearBrasil}
                  onChange={(value) =>
                    updateApplicantField(index, "bloquearBrasil", value)
                  }
                  options={[
                    { value: "", label: "Não identificado" },
                    { value: "sim", label: "Sim" },
                    { value: "nao", label: "Não" },
                    { value: "nao_sei", label: "Ainda não sei" },
                  ]}
                />

                <SelectField
                  label="Confortável em mostrar o rosto"
                  value={applicant.mostrarRosto}
                  onChange={(value) =>
                    updateApplicantField(index, "mostrarRosto", value)
                  }
                  options={[
                    { value: "", label: "Não identificado" },
                    { value: "sim", label: "Sim" },
                    { value: "nao", label: "Não" },
                    { value: "depende", label: "Depende do conteúdo" },
                  ]}
                />

                <SelectField
                  label="Moeda preferida"
                  value={applicant.moedaPreferida}
                  onChange={(value) =>
                    updateApplicantField(index, "moedaPreferida", value)
                  }
                  options={[
                    { value: "", label: "Não identificado" },
                    { value: "real", label: "Real" },
                    { value: "dolar", label: "Dólar" },
                  ]}
                />
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
                  Com que frequência pode produzir conteúdo
                </span>
                <textarea
                  rows={2}
                  value={applicant.frequenciaConteudo}
                  onChange={(event) =>
                    updateApplicantField(
                      index,
                      "frequenciaConteudo",
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
                  Motivo da candidatura
                </span>
                <textarea
                  rows={3}
                  value={applicant.motivoCandidatura}
                  onChange={(event) =>
                    updateApplicantField(
                      index,
                      "motivoCandidatura",
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
                />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addBlankApplicant}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              + Adicionar candidata em branco
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Salvando..."
                : `Salvar ${applicants.length > 1 ? `${applicants.length} candidatas` : "candidata"}`}
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
