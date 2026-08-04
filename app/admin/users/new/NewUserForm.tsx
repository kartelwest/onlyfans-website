"use client";

import { useTranslations } from "next-intl";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BirthdayDatePicker from "@/components/ui/BirthdayDatePicker";
import {
  generateTemporaryPassword,
  getModelFieldLabelKey,
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

type RepresentativeOption = {
  id: string;
  fullName: string;
  role: string;
};

type NewUserFormProps = {
  role: NewUserRole;
  currentUserRole: string;
  drafts: DraftModel[];
  selectedDraft: DraftModel | null;
  representatives: RepresentativeOption[];
};

type FormState = {
  fullName: string;
  stageName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  country: string;
  temporaryPassword: string;
  representativeId: string;
  active: boolean;
  websiteLoginEnabled: boolean;
};

const initialFormState: FormState = {
  fullName: "",
  stageName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  country: "Brasil",
  temporaryPassword: "",
  representativeId: "",
  active: true,
  websiteLoginEnabled: true,
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
    representativeId: "",
    active: true,
    websiteLoginEnabled: true,
  };
}

export default function NewUserForm({
  role,
  currentUserRole,
  drafts,
  selectedDraft,
  representatives,
}: NewUserFormProps) {
  const t = useTranslations("admin.newUser");
  const tRole = useTranslations("admin.newUser.roleWord");
  const tFieldLabels = useTranslations("admin.newUser.fieldLabels");

  /** A field name the extractor produced, shown as the label the user knows. */
  function fieldLabel(field: string) {
    const key = getModelFieldLabelKey(field);

    return key ? tFieldLabels(key) : field;
  }
  const tFields = useTranslations("admin.modelPage.fields");
  const tApply = useTranslations("site.apply.fields");
  const tApplyCountries = useTranslations("site.apply.countries");
  const tOwnerNew = useTranslations("owner.newUser");
  const tRepDetails = useTranslations("admin.representatives.details");
  const tReassign = useTranslations("admin.reassign");
  const tCommon = useTranslations("common.actions");
  const tRoleEnum = useTranslations("enums.role");

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

  // Lowercase, because it is dropped mid-sentence ("Criar modelo"). The
  // capitalised form is produced by `capitalize()` at the one place that needs
  // it, so the catalog only carries the word once.
  const roleLabel = useMemo(() => tRole(role), [role, tRole]);

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
      representativeId: "",
      active: true,
      websiteLoginEnabled: true,
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
      setAiError(t("claudeModelsOnly"));
      return;
    }

    const text = aiText.trim();

    if (!text) {
      setAiError(t("pasteTextFirst"));
      return;
    }

    if (!useAI) {
      setAiError(t("enableSmartFill"));
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
          result.error || t("analyzeFailed"),
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
          : t("analyzeFailed"),
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
      setErrorMessage(t("fullNameRequired"));
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage(t("emailRequired"));
      return;
    }

    if (isModel && form.phone.replace(/\D/g, "").length < 8) {
      setErrorMessage(
        t("invalidWhatsapp"),
      );
      return;
    }

    if (isModel && !form.representativeId) {
      setErrorMessage(t("representativeRequired"));
      return;
    }

    if (
      role === "administrator" &&
      currentUserRole !== "owner"
    ) {
      setErrorMessage(
        t("ownerOnlyAdmins"),
      );
      return;
    }

    const temporaryPassword = form.temporaryPassword;

    if (isModel) {
      if (useAI && aiText.trim() && !review) {
        setErrorMessage(
          t("analyzeBeforeCreate"),
        );
        return;
      }
    } else if (temporaryPassword.length < 8) {
      setErrorMessage(
        t("passwordTooShort"),
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
          representativeId: form.representativeId,
          active: form.active,
          websiteLoginEnabled: form.websiteLoginEnabled,
          draftModelId,
          originalText: useAI ? aiText.trim() : "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            t("createFailed", { role: roleLabel }),
        );
      }

      setSuccessMessage(
        t("createSuccess", { role: capitalize(roleLabel) }),
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
          : t("unexpected"),
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
      setErrorMessage(t("draftsModelsOnly"));
      return;
    }

    if (!form.fullName.trim()) {
      setErrorMessage(t("fullNameRequiredForDraft"));
      return;
    }

    if (useAI && aiText.trim() && !review) {
      setErrorMessage(
        t("analyzeBeforeDraft"),
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
            t("draftSaveFailed"),
        );
      }

      setDraftModelId(result.modelId);
      setSuccessMessage(t("draftSaved"));

      window.setTimeout(() => {
        router.push("/admin/users/new?role=model");
        router.refresh();
      }, 800);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("unexpected"),
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
          <FormField label={t("loadDraft")}>
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
              <option value="">{t("newRecord")}</option>

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
          label={tApply("fullName")}
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
            placeholder={tApply("fullName")}
            className={inputClassName}
          />
        </FormField>

        {isModel && (
          <FormField label={tFields("stageName")}>
            <input
              type="text"
              value={form.stageName}
              onChange={(event) =>
                updateField(
                  "stageName",
                  event.target.value,
                )
              }
              placeholder={t("stageNamePlaceholder")}
              className={inputClassName}
            />
          </FormField>
        )}

        {/*
          A model always signs in with a real address — it is her contact
          e-mail too. A representative or an administrator may instead be given
          a bare username, which the server registers under the reserved login
          domain, so the field cannot be type="email" for them.
        */}
        <FormField
          label={isModel ? tFields("email") : t("emailOrUsername")}
          required
        >
          <input
            type={isModel ? "email" : "text"}
            value={form.email}
            onChange={(event) =>
              updateField("email", event.target.value)
            }
            placeholder={
              isModel ? t("emailPlaceholder") : t("emailOrUsernamePlaceholder")
            }
            autoComplete={isModel ? "email" : "off"}
            autoCapitalize={isModel ? undefined : "none"}
            spellCheck={isModel ? undefined : false}
            className={inputClassName}
          />

          {!isModel && (
            <p className="mt-2 text-xs text-white/45">
              {t("usernameHint")}
            </p>
          )}
        </FormField>

        <FormField label={tRepDetails("phone")} required={isModel}>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) =>
              updateField("phone", event.target.value)
            }
            placeholder={tOwnerNew("whatsappPlaceholder")}
            className={inputClassName}
          />
        </FormField>

        {isModel && (
          <>
            <FormField label={tFields("birthday")}>
              <BirthdayDatePicker
                theme="dark"
                value={form.dateOfBirth}
                onChange={(value) =>
                  updateField("dateOfBirth", value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label={tApply("country")}>
              <input
                type="text"
                value={form.country}
                onChange={(event) =>
                  updateField(
                    "country",
                    event.target.value,
                  )
                }
                placeholder={tApplyCountries("brazil")}
                className={inputClassName}
              />
            </FormField>
          </>
        )}

        <FormField
          label={tOwnerNew("temporaryPassword")}
          required={!isModel}
          description={
            isModel
              ? t("passwordGeneratedHint")
              : t("passwordMinLength")
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
                ? t("passwordFromWhatsappPlaceholder")
                : tOwnerNew("temporaryPassword")
            }
            autoComplete="new-password"
            disabled={isModel}
            className={`${inputClassName} ${isModel ? "cursor-not-allowed opacity-60" : ""}`}
          />
        </FormField>

        {isModel && (
          <FormField
            label={tReassign("title")}
            required
            description={t("ownerHint")}
          >
            <select
              value={form.representativeId}
              onChange={(event) =>
                updateField("representativeId", event.target.value)
              }
              className={`${inputClassName} appearance-none bg-black/30`}
            >
              <option value="">{tOwnerNew("selectRepresentative")}</option>

              {representatives.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.fullName}
                  {rep.role === "owner" ||
                  rep.role === "administrator" ||
                  rep.role === "representative"
                    ? ` (${tRoleEnum(rep.role)})`
                    : ""}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-zinc-500">
              {tOwnerNew("representativeNotFound")}{" "}
              <a
                href="/admin/users/new?role=representative"
                className="text-pink-400 underline transition hover:text-pink-300"
              >
                {tOwnerNew("registerNew")}
              </a>
            </p>
          </FormField>
        )}

        <FormField label={t("userType")}>
          <input
            type="text"
            value={capitalize(roleLabel)}
            disabled
            className={`${inputClassName} cursor-not-allowed opacity-60`}
          />
        </FormField>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ToggleField
          label={t("accountActive")}
          description={t("activeHint")}
          checked={form.active}
          onChange={(checked) =>
            updateField("active", checked)
          }
        />

        <ToggleField
          label={t("websiteLogin")}
          description={t("loginHint")}
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
            {t("claudeTitle")}
          </h2>

          <p className="mt-1 text-sm text-white/55">
            {t("claudeSubtitle")}
          </p>

          <div className="mt-4">
            <textarea
              value={aiText}
              onChange={(event) =>
                setAiText(event.target.value)
              }
              placeholder={t("claudePlaceholder")}
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
                {t("useTextToggle")}
              </p>

              <p className="text-xs leading-5 text-white/55">
                {t("useTextHint")}
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
                ? t("analyzing")
                : t("analyzeWithClaude")}
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
                {t("analysisResult")}
              </h3>

              {review.conflicts.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-amber-200">
                    {t("conflicts")}
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
                                {fieldLabel(conflict.field)}
                              </span>
                              <p className="text-amber-200/80">
                                {t("conflictCurrent", {
                                  value:
                                    conflict.current ||
                                    t("emptyValue"),
                                })}
                              </p>
                              <p className="text-amber-100">
                                {t("conflictExtracted", {
                                  value: conflict.extracted,
                                })}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                applyExtracted(conflict.field)
                              }
                              className="mt-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/30 sm:mt-0"
                            >
                              {t("useExtracted")}
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
                    {t("missingFields")}
                  </p>

                  <ul className="mt-1 list-disc pl-5 text-sm text-red-100/80">
                    {review.missing.map((item) => (
                      <li key={item}>
                        {fieldLabel(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {review.unmapped.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-white/70">
                    {t("unmapped")}
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
                    {t("allFound")}
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
          {tCommon("cancel")}
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
              ? t("updateDraft")
              : t("createDraft")}
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
            ? t("creating")
            : t("createRole", { role: roleLabel })}
        </button>
      </div>

      {isModel && needsReview && !reviewLoaded && (
        <p className="mt-3 text-right text-xs text-white/50">
          {t("analyzeFirst")}
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
