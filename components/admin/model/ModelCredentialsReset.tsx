"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { generateTemporaryPassword } from "@/lib/admin/modelOnboardingHelpers";

type ModelCredentialsResetProps = {
  modelId: string;
  modelName: string;
  currentEmail: string | null;
  whatsapp: string | null;
};

type Step = "form" | "confirm" | "success";

type PasswordMode = "none" | "preset" | "custom";

type SuccessPayload = {
  email: string | null;
  password: string | null;
  emailChanged: boolean;
  passwordChanged: boolean;
  sessionsRevoked: boolean;
  warnings: string[];
};

const MIN_PASSWORD_LENGTH = 8;

export default function ModelCredentialsReset({
  modelId,
  modelName,
  currentEmail,
  whatsapp,
}: ModelCredentialsResetProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");

  const [passwordMode, setPasswordMode] = useState<PasswordMode>("none");
  const [customPassword, setCustomPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<SuccessPayload | null>(null);

  // The agency's existing preset: last 4 digits of the WhatsApp number
  // followed by 1234567, exactly as when the model's account is created.
  const presetPassword = useMemo(() => {
    const digits = (whatsapp ?? "").replace(/\D/g, "");

    if (digits.length < 8) {
      return "";
    }

    return generateTemporaryPassword(digits);
  }, [whatsapp]);

  const effectivePassword =
    passwordMode === "preset"
      ? presetPassword
      : passwordMode === "custom"
        ? customPassword
        : "";

  const trimmedEmail = newEmail.trim();

  const emailWillChange =
    trimmedEmail.length > 0 &&
    trimmedEmail.toLowerCase() !== (currentEmail ?? "").toLowerCase();

  const hasSomethingToApply =
    effectivePassword.length > 0 || emailWillChange;

  function resetState() {
    setStep("form");
    setPasswordMode("none");
    setCustomPassword("");
    setNewEmail("");
    setErrorMessage("");
    setResult(null);
    setIsSubmitting(false);
  }

  function openModal() {
    resetState();
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);

    if (result) {
      // New credentials may have changed the e-mail shown on the page.
      router.refresh();
    }

    resetState();
  }

  function goToConfirm() {
    setErrorMessage("");

    if (!hasSomethingToApply) {
      setErrorMessage("Informe uma nova senha ou um novo e-mail.");
      return;
    }

    if (
      effectivePassword.length > 0 &&
      effectivePassword.length < MIN_PASSWORD_LENGTH
    ) {
      setErrorMessage(
        `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }

    setStep("confirm");
  }

  async function handleSubmit() {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/models/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          password: effectivePassword || undefined,
          email: emailWillChange ? trimmedEmail : undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Ocorreu um erro inesperado. Tente novamente.",
        );
      }

      setResult({
        email: payload.email ?? null,
        password: payload.password ?? null,
        emailChanged: Boolean(payload.emailChanged),
        passwordChanged: Boolean(payload.passwordChanged),
        sessionsRevoked: Boolean(payload.sessionsRevoked),
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      });

      setStep("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado. Tente novamente.",
      );

      setStep("form");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="shrink-0 rounded-xl border border-pink-400/40 bg-pink-500/15 px-4 py-2.5 text-sm font-bold text-pink-100 transition hover:bg-pink-500/25"
      >
        Redefinir acesso
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#111115] p-6">
            {step === "form" && (
              <>
                <h3 className="text-lg font-bold text-white">
                  Redefinir acesso da modelo
                </h3>

                <p className="mt-2 text-sm text-white/60">
                  Altere a senha e/ou o e-mail de login de{" "}
                  <span className="font-semibold text-white">{modelName}</span>.
                  Preencha apenas o que deseja alterar.
                </p>

                <section className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
                    Senha
                  </h4>

                  <div className="mt-3 space-y-2">
                    <RadioRow
                      name="password-mode"
                      checked={passwordMode === "none"}
                      onChange={() => setPasswordMode("none")}
                      label="Não alterar a senha"
                    />

                    <RadioRow
                      name="password-mode"
                      checked={passwordMode === "preset"}
                      onChange={() => setPasswordMode("preset")}
                      disabled={!presetPassword}
                      label="Padrão da agência (4 últimos dígitos do WhatsApp + 1234567)"
                      hint={
                        presetPassword
                          ? undefined
                          : "Preencha o WhatsApp da modelo para usar a senha padrão."
                      }
                    />

                    <RadioRow
                      name="password-mode"
                      checked={passwordMode === "custom"}
                      onChange={() => setPasswordMode("custom")}
                      label="Senha personalizada"
                    />
                  </div>

                  {passwordMode === "custom" && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={customPassword}
                        onChange={(event) =>
                          setCustomPassword(event.target.value)
                        }
                        placeholder="Digite a nova senha"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-pink-400"
                      />

                      <p className="mt-2 text-xs text-white/45">
                        Use pelo menos {MIN_PASSWORD_LENGTH} caracteres.
                      </p>
                    </div>
                  )}
                </section>

                <section className="mt-6 border-t border-white/10 pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
                    Login (e-mail)
                  </h4>

                  <p className="mt-2 text-xs text-white/45">
                    E-mail atual: {currentEmail || "não informado"}
                  </p>

                  <input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="novoemail@exemplo.com"
                    autoComplete="off"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-pink-400"
                  />

                  <p className="mt-2 text-xs text-white/45">
                    A modelo poderá entrar com este e-mail imediatamente, sem
                    precisar confirmar nada.
                  </p>
                </section>

                {errorMessage && (
                  <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {errorMessage}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={goToConfirm}
                    disabled={!hasSomethingToApply}
                    className="rounded-lg bg-pink-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Revisar alterações
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <h3 className="text-lg font-bold text-white">
                  Confirmar alterações
                </h3>

                <p className="mt-2 text-sm text-white/60">
                  Esta ação altera o acesso de{" "}
                  <span className="font-semibold text-white">{modelName}</span>{" "}
                  imediatamente. Deseja continuar?
                </p>

                <ul className="mt-5 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                  {effectivePassword && <li>• A senha será alterada.</li>}

                  {emailWillChange && (
                    <li>
                      • O e-mail de login passará a ser{" "}
                      <span className="font-semibold text-white">
                        {trimmedEmail}
                      </span>
                      .
                    </li>
                  )}
                </ul>

                {errorMessage && (
                  <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {errorMessage}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    disabled={isSubmitting}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-lg bg-pink-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Aplicando..." : "Confirmar e aplicar"}
                  </button>
                </div>
              </>
            )}

            {step === "success" && result && (
              <>
                <h3 className="text-lg font-bold text-emerald-300">
                  Acesso atualizado com sucesso
                </h3>

                <p className="mt-2 text-sm text-amber-200">
                  Anote estes dados agora. Eles não serão exibidos novamente.
                </p>

                <div className="mt-5 space-y-3">
                  {result.email && (
                    <CredentialRow
                      label="E-mail de login"
                      value={result.email}
                    />
                  )}

                  {result.password && (
                    <CredentialRow label="Nova senha" value={result.password} />
                  )}
                </div>

                {result.sessionsRevoked && (
                  <p className="mt-5 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">
                    As sessões ativas da modelo foram encerradas. Ela precisará
                    entrar novamente.
                  </p>
                )}

                {result.warnings.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {result.warnings.map((warning) => (
                      <p
                        key={warning}
                        className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg bg-pink-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-pink-300"
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RadioRow({
  name,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/30"
          : checked
            ? "cursor-pointer border-pink-400/50 bg-pink-500/10 text-white"
            : "cursor-pointer border-white/10 bg-black/20 text-white/70 hover:bg-white/5"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 accent-pink-400"
      />

      <span>
        {label}

        {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
      </span>
    </label>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="break-all font-mono text-base font-bold text-white">
          {value}
        </p>

        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/10"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
