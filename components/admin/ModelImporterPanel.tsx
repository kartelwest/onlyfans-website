"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("admin.importer");
  const tApply = useTranslations("site.apply.fields");
  const tApplyOpts = useTranslations("site.apply");
  const tOverview = useTranslations("admin.overview");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");

  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const [slotFiles, setSlotFiles] = useState<Array<File | null>>(
    Array(MAX_FILES).fill(null),
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const [clarification, setClarification] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<EditableApplicant[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveResult, setSaveResult] = useState<ConfirmResponse | null>(null);

  const files = slotFiles.filter(
    (file): file is File => file !== null,
  );

  function resetResults() {
    setExtractError("");
    setClarification(null);
    setApplicants([]);
    setSaveResult(null);
    setSaveError("");
  }

  function handleSlotFileChange(
    slotIndex: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selected = event.target.files?.[0] ?? null;

    setSlotFiles((current) =>
      current.map((file, i) => (i === slotIndex ? selected : file)),
    );

    setExtractError("");
    setClarification(null);
    setApplicants([]);
    setSaveResult(null);
    setSaveError("");
  }

  function removeSlotFile(slotIndex: number) {
    setSlotFiles((current) =>
      current.map((file, i) => (i === slotIndex ? null : file)),
    );
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
        throw new Error(result.error || t("settingsSaveFailed"));
      }

      setAutoSave(nextValue);
    } catch (error) {
      setExtractError(
        error instanceof Error ? error.message : tErrors("generic"),
      );
    } finally {
      setIsSavingSetting(false);
    }
  }

  async function handleExtract() {
    if (files.length === 0 || isExtracting) {
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
        throw new Error(result.error || t("readFailed"));
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
        error instanceof Error ? error.message : tErrors("generic"),
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
        throw new Error(result.error || t("saveApplicantsFailed"));
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
        error instanceof Error ? error.message : tErrors("generic"),
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
            {t("autoSave")}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {autoSave
              ? t("autoSaveOnHint")
              : t("autoSaveOffHint")}
            {!isOwner && ` ${t("ownerOnlySetting")}`}
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
          {autoSave ? t("on") : t("off")}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111115] p-6">
        <p className="text-sm font-bold text-white">{t("files")}</p>
        <p className="mt-1 text-xs text-white/50">
          {t("filesHint", { max: MAX_FILES })}
        </p>

        <div className="mt-4 space-y-3">
          {slotFiles.map((slotFile, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-[#08080a] px-4 py-3"
            >
              <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-white/45">
                {t("fileN", { index: index + 1 })}
              </span>

              <label
                htmlFor={`import-file-slot-${index}`}
                className="shrink-0 cursor-pointer rounded-lg bg-pink-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-pink-400"
              >
                {t("chooseFile")}
              </label>

              <input
                id={`import-file-slot-${index}`}
                key={slotFile?.name ?? `empty-${index}`}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => handleSlotFileChange(index, event)}
                className="hidden"
              />

              <span className="min-w-0 flex-1 truncate text-sm text-white/60">
                {slotFile?.name ?? t("noFileSelected")}
              </span>

              {slotFile && (
                <button
                  type="button"
                  onClick={() => removeSlotFile(index)}
                  className="shrink-0 text-xs font-bold text-red-300 hover:text-red-200"
                >
                  {tCommon("remove")}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExtract}
          disabled={files.length === 0 || isExtracting}
          className="mt-4 rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExtracting ? t("analyzing") : t("extract")}
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
                  {t("applicantN", { index: index + 1 })}
                </p>

                <button
                  type="button"
                  onClick={() => removeApplicant(index)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  {tCommon("remove")}
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label={tApply("fullName")}
                  value={applicant.nomeCompleto}
                  onChange={(value) =>
                    updateApplicantField(index, "nomeCompleto", value)
                  }
                  required
                />
                <Field
                  label={tApply("stageName")}
                  value={applicant.nomeArtisticoDesejado}
                  onChange={(value) =>
                    updateApplicantField(index, "nomeArtisticoDesejado", value)
                  }
                />
                <Field
                  label={tApply("birthday")}
                  value={applicant.dataNascimento}
                  onChange={(value) =>
                    updateApplicantField(index, "dataNascimento", value)
                  }
                  placeholder={tOverview("placeholders.date")}
                />
                <Field
                  label={tApply("city")}
                  value={applicant.cidade}
                  onChange={(value) =>
                    updateApplicantField(index, "cidade", value)
                  }
                />
                <Field
                  label={tApply("state")}
                  value={applicant.estado}
                  onChange={(value) =>
                    updateApplicantField(index, "estado", value)
                  }
                />
                <Field
                  label={tApply("country")}
                  value={applicant.pais}
                  onChange={(value) =>
                    updateApplicantField(index, "pais", value)
                  }
                />
                <Field
                  label={tApply("whatsapp")}
                  value={applicant.whatsapp}
                  onChange={(value) =>
                    updateApplicantField(index, "whatsapp", value)
                  }
                />
                <Field
                  label={tApply("email")}
                  value={applicant.email}
                  onChange={(value) =>
                    updateApplicantField(index, "email", value)
                  }
                />
                <Field
                  label={tApply("instagram")}
                  value={applicant.instagram}
                  onChange={(value) =>
                    updateApplicantField(index, "instagram", value)
                  }
                />
                <Field
                  label={tApply("twitter")}
                  value={applicant.twitter}
                  onChange={(value) =>
                    updateApplicantField(index, "twitter", value)
                  }
                />

                <SelectField
                  label={t("referredBy")}
                  value={applicant.representanteIndicacao}
                  onChange={(value) =>
                    updateApplicantField(index, "representanteIndicacao", value)
                  }
                  options={[
                    { value: "", label: t("notIdentified") },
                    { value: "Kartel", label: "Kartel" },
                    { value: "Rayssa", label: "Rayssa" },
                    { value: "Antonio (Tony)", label: "Antonio (Tony)" },
                    { value: "Boca a boca", label: "Boca a boca" },
                  ]}
                />

                <SelectField
                  label={t("hasOnlyFans")}
                  value={applicant.possuiOnlyfans}
                  onChange={(value) =>
                    updateApplicantField(index, "possuiOnlyfans", value)
                  }
                  options={[
                    { value: "", label: t("notIdentified") },
                    { value: "sim", label: tState("yes") },
                    { value: "nao", label: tState("no") },
                  ]}
                />

                <SelectField
                  label={t("blockBrazil")}
                  value={applicant.bloquearBrasil}
                  onChange={(value) =>
                    updateApplicantField(index, "bloquearBrasil", value)
                  }
                  options={[
                    { value: "", label: t("notIdentified") },
                    { value: "sim", label: tState("yes") },
                    { value: "nao", label: tState("no") },
                    { value: "nao_sei", label: tApplyOpts("options.notSure") },
                  ]}
                />

                <SelectField
                  label={t("showFace")}
                  value={applicant.mostrarRosto}
                  onChange={(value) =>
                    updateApplicantField(index, "mostrarRosto", value)
                  }
                  options={[
                    { value: "", label: t("notIdentified") },
                    { value: "sim", label: tState("yes") },
                    { value: "nao", label: tState("no") },
                    { value: "depende", label: tApplyOpts("options.depends") },
                  ]}
                />

                <SelectField
                  label={tApply("currency")}
                  value={applicant.moedaPreferida}
                  onChange={(value) =>
                    updateApplicantField(index, "moedaPreferida", value)
                  }
                  options={[
                    { value: "", label: t("notIdentified") },
                    { value: "real", label: tApplyOpts("options.real") },
                    { value: "dolar", label: tApplyOpts("options.dollar") },
                  ]}
                />
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/50">
                  {t("contentFrequency")}
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
                  {t("motivation")}
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
                ? tCommon("saving")
                : t("saveApplicants", { count: applicants.length })}
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
