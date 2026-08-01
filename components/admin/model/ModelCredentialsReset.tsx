"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { generateTemporaryPassword } from "@/lib/admin/modelOnboardingHelpers";
import {
  looksLikeEmail,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/loginIdentifier";

type ModelCredentialsResetProps = {
  modelId: string;
  modelName: string;
  /** Her contact e-mail on file — not necessarily her login. */
  currentEmail: string | null;
  /** What she signs in with today: a username, an e-mail, or nothing yet. */
  currentLogin: string | null;
  whatsapp: string | null;
  /**
   * False when the model has no auth account yet — most model records are
   * created by /aplicar or the importer and never get one. The same action
   * then creates her login instead of changing it.
   */
  hasLogin: boolean;
};

type Step = "form" | "confirm" | "success";

type PasswordMode = "none" | "preset" | "custom";

type SuccessPayload = {
  login: string | null;
  password: string | null;
  loginChanged: boolean;
  passwordChanged: boolean;
  accessCreated: boolean;
  sessionsRevoked: boolean;
  warnings: string[];
};

const MIN_PASSWORD_LENGTH = 8;

export default function ModelCredentialsReset({
  modelId,
  modelName,
  currentEmail,
  currentLogin,
  whatsapp,
  hasLogin,
}: ModelCredentialsResetProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");

  // Creating an access requires a password, so "leave it alone" is not an
  // option in that mode.
  const [passwordMode, setPasswordMode] = useState<PasswordMode>(
    hasLogin ? "none" : "preset",
  );
  const [customPassword, setCustomPassword] = useState("");
  const [newLogin, setNewLogin] = useState("");

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

  const trimmedLogin = newLogin.trim();

  // Whatever is typed is an e-mail if it contains "@", otherwise a username.
  const loginIsUsername =
    trimmedLogin.length > 0 && !looksLikeEmail(trimmedLogin);

  const loginWillChange =
    trimmedLogin.length > 0 &&
    trimmedLogin.toLowerCase() !== (currentLogin ?? "").toLowerCase();

  // Creating an access needs a password and an address to register it under —
  // either newly typed or the one already on her record.
  const hasSomethingToApply = hasLogin
    ? effectivePassword.length > 0 || loginWillChange
    : effectivePassword.length > 0 &&
      (trimmedLogin.length > 0 || Boolean(currentEmail));

  function resetState() {
    setStep("form");
    setPasswordMode(hasLogin ? "none" : "preset");
    setCustomPassword("");
    setNewLogin("");
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
      if (!hasLogin && effectivePassword.length === 0) {
        setErrorMessage("Informe uma senha para criar o acesso desta modelo.");
        return;
      }

      if (!hasLogin) {
        setErrorMessage(
          "Informe um e-mail ou um nome de usuário para criar o acesso desta modelo.",
        );
        return;
      }

      setErrorMessage("Informe uma nova senha ou um novo login.");
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

    if (loginIsUsername && !normalizeUsername(trimmedLogin)) {
      setErrorMessage(
        `O nome de usuário deve ter de ${USERNAME_MIN_LENGTH} a ${USERNAME_MAX_LENGTH} caracteres e usar apenas letras, números, ponto, hífen ou sublinhado.`,
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
          login:
            loginWillChange || (!hasLogin && trimmedLogin)
              ? trimmedLogin
              : undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Ocorreu um erro inesperado. Tente novamente.",
        );
      }

      setResult({
        login: payload.login ?? null,
        password: payload.password ?? null,
        loginChanged: Boolean(payload.loginChanged),
        passwordChanged: Boolean(payload.passwordChanged),
        accessCreated: Boolean(payload.accessCreated),
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
        {hasLogin ? "Redefinir acesso" : "Criar acesso"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#111115] p-6">
            {step === "form" && (
              <>
                <h3 className="text-lg font-bold text-white">
                  {hasLogin
                    ? "Redefinir acesso da modelo"
                    : "Criar acesso da modelo"}
                </h3>

                <p className="mt-2 text-sm text-white/60">
                  {hasLogin ? (
                    <>
                      Altere a senha e/ou o e-mail de login de{" "}
                      <span className="font-semibold text-white">
                        {modelName}
                      </span>
                      . Preencha apenas o que deseja alterar.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-white">
                        {modelName}
                      </span>{" "}
                      ainda não tem login no site. Defina uma senha e o e-mail
                      de acesso para criar o login dela agora.
                    </>
                  )}
                </p>

                <section className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
                    Senha
                  </h4>

                  <div className="mt-3 space-y-2">
                    {hasLogin && (
                      <RadioRow
                        name="password-mode"
                        checked={passwordMode === "none"}
                        onChange={() => setPasswordMode("none")}
                        label="Não alterar a senha"
                      />
                    )}

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
                    Login (e-mail ou nome de usuário)
                  </h4>

                  <p className="mt-2 text-xs text-white/45">
                    {hasLogin
                      ? `Login atual: ${currentLogin || "não informado"}`
                      : currentEmail
                        ? `Deixe em branco para usar o e-mail da ficha: ${currentEmail}`
                        : "Obrigatório: informe um e-mail ou crie um nome de usuário."}
                  </p>

                  <input
                    type="text"
                    value={newLogin}
                    onChange={(event) => setNewLogin(event.target.value)}
                    placeholder="maria@exemplo.com ou maria.silva"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-pink-400"
                  />

                  <p className="mt-2 text-xs text-white/45">
                    {loginIsUsername
                      ? "Nome de usuário: a modelo entra digitando apenas isso, sem e-mail. Use letras, números, ponto, hífen ou sublinhado."
                      : "Com \"@\" será tratado como e-mail; sem \"@\", como nome de usuário. A modelo poderá entrar imediatamente, sem precisar confirmar nada."}
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
                  {hasLogin ? "Confirmar alterações" : "Confirmar criação de acesso"}
                </h3>

                <p className="mt-2 text-sm text-white/60">
                  {hasLogin ? (
                    <>
                      Esta ação altera o acesso de{" "}
                      <span className="font-semibold text-white">
                        {modelName}
                      </span>{" "}
                      imediatamente. Deseja continuar?
                    </>
                  ) : (
                    <>
                      Esta ação cria o login de{" "}
                      <span className="font-semibold text-white">
                        {modelName}
                      </span>{" "}
                      imediatamente. Deseja continuar?
                    </>
                  )}
                </p>

                <ul className="mt-5 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                  {!hasLogin && <li>• O login da modelo será criado.</li>}

                  {effectivePassword && (
                    <li>
                      {hasLogin
                        ? "• A senha será alterada."
                        : "• A senha será definida."}
                    </li>
                  )}

                  {(loginWillChange || (!hasLogin && currentEmail)) && (
                    <li>
                      •{" "}
                      {loginIsUsername
                        ? "O nome de usuário"
                        : "O e-mail de login"}{" "}
                      {hasLogin ? "passará a ser" : "será"}{" "}
                      <span className="font-semibold text-white">
                        {trimmedLogin || currentEmail}
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
                  {result.accessCreated
                    ? "Acesso criado com sucesso"
                    : "Acesso atualizado com sucesso"}
                </h3>

                <p className="mt-2 text-sm text-amber-200">
                  Anote estes dados agora. Eles não serão exibidos novamente.
                </p>

                <div className="mt-5 space-y-3">
                  {result.login && (
                    <CredentialRow
                      label={
                        looksLikeEmail(result.login)
                          ? "E-mail de login"
                          : "Nome de usuário"
                      }
                      value={result.login}
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
