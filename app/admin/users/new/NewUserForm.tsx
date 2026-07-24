"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SpanishDatePicker from "@/components/ui/SpanishDatePicker";

type NewUserRole =
  | "model"
  | "representative"
  | "administrator";

type NewUserFormProps = {
  role: NewUserRole;
  currentUserRole: string;
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
};

export default function NewUserForm({
  role,
  currentUserRole,
}: NewUserFormProps) {
  const router = useRouter();

  const [form, setForm] =
    useState<FormState>(initialFormState);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const roleLabel = useMemo(() => {
    if (role === "representative") {
      return "representante";
    }

    if (role === "administrator") {
      return "administrador";
    }

    return "modelo";
  }, [role]);

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.fullName.trim()) {
      setErrorMessage("Informe o nome completo.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Informe o e-mail.");
      return;
    }

    if (form.temporaryPassword.length < 8) {
      setErrorMessage(
        "A senha temporária deve ter pelo menos 8 caracteres.",
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

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/admin/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role,
            fullName: form.fullName.trim(),
            stageName: form.stageName.trim(),
            email: form.email
              .trim()
              .toLowerCase(),
            phone: form.phone.trim(),
            dateOfBirth:
              form.dateOfBirth || null,
            country: form.country.trim(),
            temporaryPassword:
              form.temporaryPassword,
            active: form.active,
            websiteLoginEnabled:
              form.websiteLoginEnabled,
          }),
        },
      );

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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-[#111115] p-5 sm:p-8"
    >
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

        {role === "model" && (
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
              updateField(
                "email",
                event.target.value,
              )
            }
            placeholder="email@exemplo.com"
            autoComplete="email"
            className={inputClassName}
          />
        </FormField>

        <FormField label="Telefone / WhatsApp">
          <input
            type="tel"
            value={form.phone}
            onChange={(event) =>
              updateField(
                "phone",
                event.target.value,
              )
            }
            placeholder="+55 21 99999-9999"
            className={inputClassName}
          />
        </FormField>

        {role === "model" && (
          <>
            <FormField label="Data de nascimento">
              <SpanishDatePicker
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
          required
          description="Use pelo menos 8 caracteres."
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
            placeholder="Senha temporária"
            autoComplete="new-password"
            className={inputClassName}
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? "Criando..."
            : `Criar ${roleLabel}`}
        </button>
      </div>
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