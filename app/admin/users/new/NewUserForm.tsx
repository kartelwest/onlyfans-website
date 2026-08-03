"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BirthdayDatePicker from "@/components/ui/BirthdayDatePicker";
import {
  generateTemporaryPassword,
  getModelFieldLabel,
} from "@/lib/admin/modelOnboardingHelpers";

type NewUserRole =
  | "model"
  | "representative"
  | "administrator";

type DraftModel = {
  id: string;
  slug: string;
  display_name: string | null;
  stage_name: string | null;
  email: string | null;
  whatsapp: string | null;
  birthday: string | null;
  nationality: string | null;
};

export type AssigneeOption = {
  id: string;
  fullName: string;
  role: string;
  email: string | null;
};

type NewUserFormProps = {
  role: NewUserRole;
  currentUserRole: string;
  drafts: DraftModel[];
  selectedDraft: DraftModel | null;
  /** Active representatives and admins — who a new model may be assigned to. */
  assignees: AssigneeOption[];
};

type FormState = {
  fullName: string;
  stageName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  country: string;
  temporaryPassword: string;
  active: boolean;
  websiteLoginEnabled: boolean;
  /** Empty string means "Não atribuído". */
  representativeId: string;
};

const initialFormState: FormState = {
  fullName: "",
  stageName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  country: "Brasil",
  temporaryPassword: "",
  active: true,
  websiteLoginEnabled: true,
  representativeId: "",
};

type ExtractedFields = {
  fullName: string | null;
  stageName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  country: string | null;
};

type ConflictItem = {
  field: keyof ExtractedFields;
  label: string;
  current: string;
  extracted: string;
};

type Review = {
  extracted: ExtractedFields;
  conflicts: ConflictItem[];
  missing: string[];
  unmapped: string[];
};

function buildInitialFormState(
  selectedDraft: DraftModel | null,
): FormState {
  if (!selectedDraft) {
    return initialFormState;
  }

  return {
    fullName: selectedDraft.display_name ?? "",
    stageName: selectedDraft.stage_name ?? "",
    email: selectedDraft.email ?? "",
    phone: selectedDraft.whatsapp ?? "",
    dateOfBirth: selectedDraft.birthday ?? "",
    country: selectedDraft.nationality ?? "Brasil",
    temporaryPassword: "",
    active: true,
    websiteLoginEnabled: true,
    representativeId: "",
  };
}

export default function NewUserForm({
  role,
  currentUserRole,
  drafts,
  selectedDraft,
  assignees,
}: NewUserFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(
    buildInitialFormState(selectedDraft),
  );

  const [draftModelId, setDraftModelId] = useState<string | null>(
    selectedDraft?.id ?? null,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [aiError, setAiError] = useState("");

  const [aiText, setAiText] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const isModel = role === "model";

  const roleLabel = useMemo(() => {
    if (role === "representative") {
      return "representante";
    }

    if (role === "administrator") {
      return "administrador";
    }

    return "modelo";
  }, [role]);

  const generatedPassword = useMemo(() => {
    if (!isModel) {
      return "";
    }

    const digits = form.phone.replace(/\D/g, "");

    if (digits.length < 8) {
      return "";
    }

    return generateTemporaryPassword(digits);
  }, [isModel, form.phone]);

  useEffect(() => {
    if (isModel) {
      setForm((current) => ({
        ...current,
        temporaryPassword: generatedPassword,
      }));
    }
  }, [generatedPassword, isModel]);

  useEffect(() => {
    if (selectedDraft) {
      setForm(buildInitialFormState(selectedDraft));
      setDraftModelId(selectedDraft.id);
    }
  }, [selectedDraft]);

  function updateField<
    FieldName extends keyof FormState,
  >(
    field: FieldName,
    value: FormState[FieldName],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function loadDraft(draftId: string) {
    const draft = drafts.find((item) => item.id === draftId);

    if (!draft) {
      return;
    }

    setForm({
      fullName: draft.display_name ?? "",
      stageName: draft.stage_name ?? "",
      email: draft.email ?? "",
      phone: draft.whatsapp ?? "",
      dateOfBirth: draft.birthday ?? "",
      country: draft.nationality ?? "Brasil",
      temporaryPassword: "",
      active: true,
      websiteLoginEnabled: true,
      representativeId: "",
    });

    setDraftModelId(draft.id);
    setReview(null);
    setAiError("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function clearDraft() {
    setForm(initialFormState);
    setDraftModelId(null);
    setReview(null);
    setAiError("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function applyExtracted(field: keyof ExtractedFields) {
    if (!review?.extracted[field]) {
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: review.extracted[field],
    }));

    setReview((current) =>
      current
        ? {
            ...current,
            conflicts: current.conflicts.filter(
              (conflict) => conflict.field !== field,
            ),
          }
        : null,
    );
  }

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setAiError("");

    if (!isModel) {
      setAiError("A análise com Claude está disponível apenas para modelos.");
      return;
    }

    const text = aiText.trim();

    if (!text) {
      setAiError("Cole o texto da modelo antes de analisar.");
      return;
    }

    if (!useAI) {
      setAiError("Ative a opção de preenchimento inteligente para analisar.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch(
        "/api/admin/users/parse-claude",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            currentForm: {
              fullName: form.fullName,
              stageName: form.stageName,
              email: form.email,
              phone: form.phone,
              dateOfBirth: form.dateOfBirth,
              country: form.country,
            },
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível analisar o texto.",
        );
      }

      const extracted = result.extracted as ExtractedFields;

      setReview({
        extracted,
        conflicts: result.conflicts ?? [],
        missing: result.missing ?? [],
        unmapped: result.unmapped ?? [],
      });

      setForm((current) => {
        const updates: Partial<FormState> = {};

        const fields: (keyof ExtractedFields)[] = [
          "fullName",
          "stageName",
          "email",
          "phone",
          "dateOfBirth",
          "country",
        ];

        for (const field of fields) {
          const extractedValue = extracted[field];

          if (!extractedValue) {
            continue;
          }

          const currentValue = current[field];

          if (
            typeof currentValue !== "string" ||
            currentValue.trim() === ""
          ) {
            (updates as Record<string, unknown>)[field] =
              extractedValue;
          }
        }

        if (Object.keys(updates).length === 0) {
          return current;
        }

        return { ...current, ...updates };
      });
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao analisar o texto.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCreate() {
    setErrorMessage("");
    setSuccessMessage("");
    setAiError("");

    if (!form.fullName.trim()) {
      setErrorMessage("Informe o nome completo.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Informe o e-mail.");
      return;
    }

    if (isModel && form.phone.replace(/\D/g, "").length < 8) {
      setErrorMessage(
        "Informe um número de WhatsApp válido com pelo menos 8 dígitos.",
      );
      return;
    }

    if (
      role === "administrator" &&
      currentUserRole !== "owner"
    ) {
      setErrorMessage(
        "Somente o proprietário pode criar administradores.",
      );
      return;
    }

    const temporaryPassword = form.temporaryPassword;

    if (isModel) {
      if (useAI && aiText.trim() && !review) {
        setErrorMessage(
          "Analise o texto com Claude antes de criar o cadastro.",
        );
        return;
      }
    } else if (temporaryPassword.length < 8) {
      setErrorMessage(
        "A senha temporária deve ter pelo menos 8 caracteres.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          fullName: form.fullName.trim(),
          stageName: form.stageName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth || null,
          country: form.country.trim(),
          temporaryPassword,
          active: form.active,
          websiteLoginEnabled: form.websiteLoginEnabled,
          representativeId:
            form.representativeId || null,
          draftModelId,
          originalText: useAI ? aiText.trim() : "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Não foi possível criar o ${roleLabel}.`,
        );
      }

      setSuccessMessage(
        `${capitalize(roleLabel)} criado com sucesso.`,
      );

      setForm(initialFormState);
      setDraftModelId(null);
      setAiText("");
      setUseAI(false);
      setReview(null);

      window.setTimeout(() => {
        router.push("/admin/models");
        router.refresh();
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateDraft() {
    setErrorMessage("");
    setSuccessMessage("");
    setAiError("");

    if (!isModel) {
      setErrorMessage("Rascunhos só podem ser criados para modelos.");
      return;
    }

    if (!form.fullName.trim()) {
      setErrorMessage("Informe o nome completo para criar um rascunho.");
      return;
    }

    if (useAI && aiText.trim() && !review) {
      setErrorMessage(
        "Analise o texto com Claude antes de salvar o rascunho.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/admin/users/drafts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            stageName: form.stageName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            dateOfBirth: form.dateOfBirth || null,
            country: form.country.trim(),
            originalText: aiText.trim(),
            draftModelId,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Não foi possível salvar o rascunho.",
        );
      }

      setDraftModelId(result.modelId);
      setSuccessMessage("Rascunho salvo com sucesso.");

      window.setTimeout(() => {
        router.push("/admin/users/new?role=model");
        router.refresh();
      }, 800);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const phoneDigits = form.phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 8;

  const canCreateModel =
    isModel &&
    form.fullName.trim() !== "" &&
    form.email.trim() !== "" &&
    phoneValid;

  const needsReview = useAI && aiText.trim() !== "";
  const reviewLoaded = review !== null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (isModel && needsReview && !reviewLoaded) {
          return;
        }

        if (isModel && !canCreateModel) {
          return;
        }

        handleCreate();
      }}
      className="rounded-2xl border border-white/10 bg-[#111115] p-5 sm:p-8"
    >
      {isModel && drafts.length > 0 && (
        <div className="mb-6">
          <FormField label="Carregar rascunho">
            <select
              value={draftModelId ?? ""}
              onChange={(event) => {
                const value = event.target.value;

                if (value) {
                  loadDraft(value);
                } else {
                  clearDraft();
                }
              }}
              className={inputClassName}
            >
              <option value="">Novo cadastro</option>

              {drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.display_name || draft.slug}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          label="Nome completo"
          required
        >
          <input
            type="text"
            value={form.fullName}
            onChange={(event) =>
              updateField(
                "fullName",
                event.target.value,
              )
            }
            placeholder="Nome completo"
            className={inputClassName}
          />
        </FormField>

        {isModel && (
          <FormField label="Nome artístico">
            <input
              type="text"
              value={form.stageName}
              onChange={(event) =>
                updateField(
                  "stageName",
                  event.target.value,
                )
              }
              placeholder="Nome usado profissionalmente"
              className={inputClassName}
            />
          </FormField>
        )}

        <FormField label="E-mail" required>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              updateField("email", event.target.value)
            }
            placeholder="email@exemplo.com"
            autoComplete="email"
            className={inputClassName}
          />
        </FormField>

        <FormField label="Telefone / WhatsApp" required={isModel}>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) =>
              updateField("phone", event.target.value)
            }
            placeholder="+55 21 99999-9999"
            className={inputClassName}
          />
        </FormField>

        {isModel && (
          <>
            <FormField label="Data de nascimento">
              <BirthdayDatePicker
                theme="dark"
                value={form.dateOfBirth}
                onChange={(value) =>
                  updateField("dateOfBirth", value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="País">
              <input
                type="text"
                value={form.country}
                onChange={(event) =>
                  updateField(
                    "country",
                    event.target.value,
                  )
                }
                placeholder="Brasil"
                className={inputClassName}
              />
            </FormField>
          </>
        )}

        <FormField
          label="Senha temporária"
          required={!isModel}
          description={
            isModel
              ? "Gerada automaticamente pelos 4 últimos dígitos do WhatsApp + 1234567."
              : "Use pelo menos 8 caracteres."
          }
        >
          <input
            type="password"
            value={form.temporaryPassword}
            onChange={(event) =>
              updateField(
                "temporaryPassword",
                event.target.value,
              )
            }
            placeholder={
              isModel
                ? "Preencha o WhatsApp para gerar a senha"
                : "Senha temporária"
            }
            autoComplete="new-password"
            disabled={isModel}
            className={`${inputClassName} ${isModel ? "cursor-not-allowed opacity-60" : ""}`}
          />
        </FormField>

        <FormField label="Tipo de usuário">
          <input
            type="text"
            value={capitalize(roleLabel)}
            disabled
            className={`${inputClassName} cursor-not-allowed opacity-60`}
          />
        </FormField>

        {isModel && (
          <FormField label="Representante responsável">
            <select
              value={form.representativeId}
              onChange={(event) =>
                updateField(
                  "representativeId",
                  event.target.value,
                )
              }
              className={inputClassName}
            >
              <option value="">Não atribuído</option>

              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.fullName} — {assignee.role}
                  {assignee.email ? ` — ${assignee.email}` : ""}
                </option>
              ))}
            </select>

            {/*
              Only accounts that can actually work the model appear above:
              active representatives and admins, never an inactive or archived
              one. When the right person is missing, the answer is to create
              the account properly, not to invent a half-filled record here.
            */}
            <p className="mt-2 text-xs leading-5 text-white/45">
              Só aparecem contas ativas.{" "}
              <a
                href="/admin/users/new?role=representative"
                className="font-semibold text-pink-300 underline-offset-2 hover:underline"
              >
                Adicionar representante
              </a>{" "}
              se quem você procura não está na lista.
            </p>
          </FormField>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ToggleField
          label="Conta ativa"
          description="Permite que o usuário seja reconhecido pelo CRM."
          checked={form.active}
          onChange={(checked) =>
            updateField("active", checked)
          }
        />

        <ToggleField
          label="Login no website"
          description="Permite acesso à área privada do sistema."
          checked={form.websiteLoginEnabled}
          onChange={(checked) =>
            updateField(
              "websiteLoginEnabled",
              checked,
            )
          }
        />
      </div>

      {isModel && (
        <div className="mt-8 border-t border-white/10 pt-8">
          <h2 className="text-lg font-bold text-white">
            Cadastro inteligente com Claude
          </h2>

          <p className="mt-1 text-sm text-white/55">
            Cole aqui as informações completas da modelo. Claude analisará o texto e preencherá os campos correspondentes automaticamente.
          </p>

          <div className="mt-4">
            <textarea
              value={aiText}
              onChange={(event) =>
                setAiText(event.target.value)
              }
              placeholder="Cole aqui nome completo, nome artístico, e-mail, WhatsApp, data de nascimento, país e demais informações disponíveis."
              rows={5}
              className={`${inputClassName} min-h-[120px] resize-y`}
            />
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(event) =>
                setUseAI(event.target.checked)
              }
              className="mt-1 h-5 w-5 accent-pink-500"
            />

            <div>
              <p className="text-sm font-bold text-white">
                Usar este texto para preencher o cadastro e substituir o preenchimento manual dos campos obrigatórios
              </p>

              <p className="text-xs leading-5 text-white/55">
                Quando ativado, o sistema usará o texto acima para identificar e preencher os campos obrigatórios antes de criar o cadastro.
              </p>
            </div>
          </label>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={
                isAnalyzing ||
                !useAI ||
                aiText.trim().length === 0
              }
              className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing
                ? "Analisando informações…"
                : "Analisar com Claude"}
            </button>
          </div>

          {aiError && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
              {aiError}
            </div>
          )}

          {review && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
              <h3 className="font-bold text-white">
                Resultado da análise
              </h3>

              {review.conflicts.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-amber-200">
                    Conflitos detectados (valor manual mantido por padrão)
                  </p>

                  <ul className="mt-2 space-y-2">
                    {review.conflicts.map(
                      (conflict) => (
                        <li
                          key={conflict.field}
                          className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <span className="font-semibold text-amber-100">
                                {conflict.label}
                              </span>
                              <p className="text-amber-200/80">
                                Atual: {conflict.current || "(vazio)"}
                              </p>
                              <p className="text-amber-100">
                                Extraído: {conflict.extracted}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                applyExtracted(conflict.field)
                              }
                              className="mt-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/30 sm:mt-0"
                            >
                              Usar extraído
                            </button>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {review.missing.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-red-200">
                    Campos obrigatórios ou úteis não encontrados
                  </p>

                  <ul className="mt-1 list-disc pl-5 text-sm text-red-100/80">
                    {review.missing.map((item) => (
                      <li key={item}>
                        {getModelFieldLabel(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {review.unmapped.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-white/70">
                    Informação não mapeada
                  </p>

                  <ul className="mt-1 list-disc pl-5 text-sm text-white/60">
                    {review.unmapped.map(
                      (item, index) => (
                        <li key={index}>{item}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {review.missing.length === 0 &&
                review.conflicts.length === 0 &&
                review.unmapped.length === 0 && (
                  <p className="mt-4 text-sm text-emerald-200">
                    Todos os campos foram identificados com sucesso.
                  </p>
                )}
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          {successMessage}
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() =>
            router.push("/admin/models")
          }
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
        >
          Cancelar
        </button>

        {isModel && needsReview && !canCreateModel && (
          <button
            type="button"
            onClick={handleCreateDraft}
            disabled={
              isSubmitting ||
              isAnalyzing ||
              !form.fullName.trim()
            }
            className="rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draftModelId
              ? "Atualizar rascunho"
              : "Criar rascunho"}
          </button>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={
            isSubmitting ||
            isAnalyzing ||
            (isModel && needsReview && !reviewLoaded) ||
            (isModel && !canCreateModel && needsReview)
          }
          className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? "Criando..."
            : `Criar ${roleLabel}`}
        </button>
      </div>

      {isModel && needsReview && !reviewLoaded && (
        <p className="mt-3 text-right text-xs text-white/50">
          Analise o texto com Claude antes de criar o cadastro.
        </p>
      )}
    </form>
  );
}

function FormField({
  label,
  required = false,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">
        {label}

        {required && (
          <span className="ml-1 text-pink-400">
            *
          </span>
        )}
      </span>

      {description && (
        <span className="mt-1 block text-xs text-white/40">
          {description}
        </span>
      )}

      <div className="mt-2">{children}</div>
    </label>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <p className="text-sm font-bold text-white">
          {label}
        </p>

        <p className="mt-1 text-xs leading-5 text-white/45">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-1 h-5 w-5 accent-pink-500"
      />
    </label>
  );
}

function capitalize(value: string) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

const inputClassName =
  "w-full rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-400";
