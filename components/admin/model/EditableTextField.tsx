"use client";

import {
  useEffect,
  useState,
} from "react";

type EditableTextFieldProps = {
  label: string;
  value: string | null;
  placeholder?: string;
  disabled?: boolean;
  inputType?: "text" | "email" | "url" | "tel";
  onSave: (value: string) => Promise<void>;
};

export default function EditableTextField({
  label,
  value,
  placeholder = "",
  disabled = false,
  inputType = "text",
  onSave,
}: EditableTextFieldProps) {
  const [currentValue, setCurrentValue] =
    useState(value ?? "");

  const [savedValue, setSavedValue] =
    useState(value ?? "");

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveError, setSaveError] = useState<
    string | null
  >(null);

  const [saveSuccess, setSaveSuccess] =
    useState(false);

  useEffect(() => {
    const normalizedValue = value ?? "";

    setCurrentValue(normalizedValue);
    setSavedValue(normalizedValue);
  }, [value]);

  const hasChanges =
    currentValue.trim() !== savedValue.trim();

  async function handleSave() {
    if (
      disabled ||
      isSaving ||
      !hasChanges
    ) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const normalizedValue =
        currentValue.trim();

      await onSave(normalizedValue);

      setSavedValue(normalizedValue);
      setCurrentValue(normalizedValue);
      setSaveSuccess(true);

      window.setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setCurrentValue(savedValue);
    setSaveError(null);
    setSaveSuccess(false);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>

        <input
          type={inputType}
          value={currentValue}
          disabled={disabled || isSaving}
          placeholder={placeholder}
          onChange={(event) => {
            setCurrentValue(
              event.target.value,
            );

            setSaveError(null);
            setSaveSuccess(false);
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              hasChanges
            ) {
              event.preventDefault();
              void handleSave();
            }

            if (event.key === "Escape") {
              handleCancel();
            }
          }}
          className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={
            disabled ||
            isSaving ||
            !hasChanges
          }
          onClick={() => void handleSave()}
          className="rounded-xl bg-pink-300 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#321725] transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>

        {hasChanges && !isSaving && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/65 transition hover:bg-white/5"
          >
            Cancelar
          </button>
        )}

        {saveSuccess && (
          <span className="text-xs font-semibold text-emerald-300">
            Salvo com sucesso.
          </span>
        )}
      </div>

      {saveError && (
        <p className="mt-3 text-xs leading-5 text-red-300">
          {saveError}
        </p>
      )}
    </div>
  );
}