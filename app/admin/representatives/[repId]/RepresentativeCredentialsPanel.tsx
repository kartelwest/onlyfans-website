"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  looksLikeEmail,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/loginIdentifier";

/**
 * Editing a representative's login, from her own profile screen.
 *
 * The same three-step shape as the model's credential panel — fill in, review,
 * hand over — because it is the same job and admins should not have to learn a
 * second one.
 *
 * The password is shown exactly once, on the success step, straight from the
 * response. It is never fetched, never re-rendered on a reload, and there is no
 * "show current password" anywhere: the value does not exist outside Supabase
 * Auth, which stores only a hash.
 */

type Step = "form" | "confirm" | "success";

type PasswordMode = "none" | "generated" | "custom";

type SuccessPayload = {
  login: string | null;
  password: string | null;
  loginChanged: boolean;
  passwordChanged: boolean;
  mustChangePassword: boolean;
  sessionsRevoked: boolean;
  warnings: string[];
};

const MIN_PASSWORD_LENGTH = 8;

/**
 * A throwaway password for handing over in person. Built from
 * `crypto.getRandomValues` rather than Math.random, and never reused: the
 * representative is forced to replace it at her next login anyway.
 */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export default function RepresentativeCredentialsPanel({
  representativeId,
  representativeName,
  currentLogin,
}: {
  representativeId: string;
  representativeName: string;
  /** What she signs in with today: a username or an e-mail address. */
  currentLogin: string | null;
}) {
  const t = useTranslations("admin.repCredentials");
  // Shares the model credential dialog's wording where the sentence is the
  // same, so the two screens cannot drift apart.
  const tCred = useTranslations("admin.credentials");
  const tCommon = useTranslations("common.actions");
  const tErrors = useTranslations("errors");

  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("none");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<SuccessPayload | null>(null);

  const effectivePassword =
    passwordMode === "generated"
      ? generatedPassword
      : passwordMode === "custom"
        ? customPassword
        : "";

  const trimmedLogin = newLogin.trim();

  const loginIsUsername =
    trimmedLogin.length > 0 && !looksLikeEmail(trimmedLogin);

  const loginWillChange =
    trimmedLogin.length > 0 &&
    trimmedLogin.toLowerCase() !== (currentLogin ?? "").toLowerCase();

  const hasSomethingToApply =
    effectivePassword.length > 0 || loginWillChange;

  function reset() {
    setStep("form");
    setPasswordMode("none");
    setGeneratedPassword("");
    setCustomPassword("");
    setNewLogin("");
    setErrorMessage("");
    setResult(null);
    setIsSubmitting(false);
  }

  function chooseGenerated() {
    setPasswordMode("generated");

    if (!generatedPassword) {
      setGeneratedPassword(generatePassword());
    }
  }

  function goToConfirm() {
    setErrorMessage("");

    if (!hasSomethingToApply) {
      setErrorMessage(tCred("errors.nothingToChange"));
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
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/representatives/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          representativeId,
          password: effectivePassword || undefined,
          login: loginWillChange ? trimmedLogin : undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || tErrors("generic"),
        );
      }

      setResult({
        login: payload.login ?? null,
        password: payload.password ?? null,
        loginChanged: Boolean(payload.loginChanged),
        passwordChanged: Boolean(payload.passwordChanged),
        mustChangePassword: Boolean(payload.mustChangePassword),
        sessionsRevoked: Boolean(payload.sessionsRevoked),
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      });

      setStep("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : tErrors("generic"),
      );

      setStep("form");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "success" && result) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5">
        <h3 className="text-base font-bold text-emerald-300">
          {tCred("updatedSuccess")}
        </h3>

        <p className="mt-2 text-sm text-amber-200">
          {tCred("writeThisDown")}
        </p>

        <div className="mt-4 space-y-3">
          {result.login && (
            <CredentialRow
              label={
                looksLikeEmail(result.login)
                  ? tCred("loginEmail")
                  : tCred("username")
              }
              value={result.login}
            />
          )}

          {result.password && (
            <CredentialRow label={t("temporaryPassword")} value={result.password} />
          )}
        </div>

        {result.mustChangePassword && (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">
            {t("mustChangeNextLogin")}
          </p>
        )}

        {result.sessionsRevoked && (
          <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">
            {t("sessionsRevoked")}
          </p>
        )}

        {result.warnings.map((warning) => (
          <p
            key={warning}
            className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            {warning}
          </p>
        ))}

        <button
          type="button"
          onClick={() => {
            reset();
            router.refresh();
          }}
          className="mt-5 rounded-xl bg-pink-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-pink-300"
        >
          {t("done")}
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <h3 className="text-base font-bold text-white">
          {t("confirmTitle")}
        </h3>

        <p className="mt-2 text-sm text-white/60">
          {t.rich("confirmBody", {
            name: representativeName,
            strong: (chunks) => (
              <span className="font-semibold text-white">{chunks}</span>
            ),
          })}
        </p>

        <ul className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
          {effectivePassword && (
            <>
              <li>• {tCred("summaryPasswordChanged")}</li>
              <li>• {t("summarySessionsEnded")}</li>
              <li>• {t("summaryMustChange")}</li>
            </>
          )}

          {loginWillChange && (
            <li>
              •{" "}
              {loginIsUsername ? tCred("username") : tCred("loginEmail")}{" "}
              {tCred("willBecome")}{" "}
              <span className="font-semibold text-white">{trimmedLogin}</span>.
            </li>
          )}
        </ul>

        {errorMessage && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={isSubmitting}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {tCommon("back")}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-pink-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? tCred("applying") : tCred("confirmAndApply")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs text-white/45">
        {tCred("currentLoginLabel")}{" "}
        <span className="font-semibold text-white/80">
          {currentLogin || tCred("notProvided")}
        </span>
      </p>

      <section className="mt-5">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
          {tCred("password")}
        </h4>

        <div className="mt-3 space-y-2">
          <RadioRow
            name="rep-password-mode"
            checked={passwordMode === "none"}
            onChange={() => setPasswordMode("none")}
            label={tCred("passwordUnchanged")}
          />

          <RadioRow
            name="rep-password-mode"
            checked={passwordMode === "generated"}
            onChange={chooseGenerated}
            label={t("passwordGenerated")}
          />

          <RadioRow
            name="rep-password-mode"
            checked={passwordMode === "custom"}
            onChange={() => setPasswordMode("custom")}
            label={t("passwordCustom")}
          />
        </div>

        {passwordMode === "generated" && generatedPassword && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <code className="break-all font-mono text-sm font-bold text-white">
              {generatedPassword}
            </code>

            <button
              type="button"
              onClick={() => setGeneratedPassword(generatePassword())}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              {t("generateAnother")}
            </button>
          </div>
        )}

        {passwordMode === "custom" && (
          <div className="mt-3">
            <input
              type="text"
              value={customPassword}
              onChange={(event) => setCustomPassword(event.target.value)}
              placeholder={t("passwordPlaceholder")}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-pink-400"
            />

            <p className="mt-2 text-xs text-white/45">
              {t("minLength", { count: MIN_PASSWORD_LENGTH })}
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 border-t border-white/10 pt-6">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
          {t("loginLabel")}
        </h4>

        <input
          type="text"
          value={newLogin}
          onChange={(event) => setNewLogin(event.target.value)}
          placeholder={t("loginPlaceholder")}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-pink-400"
        />

        <p className="mt-2 text-xs text-white/45">
          {loginIsUsername
            ? t("usernameHint")
            : t("loginHint")}
        </p>
      </section>

      {errorMessage && (
        <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={goToConfirm}
          disabled={!hasSomethingToApply}
          className="rounded-xl bg-pink-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tCred("reviewChanges")}
        </button>
      </div>
    </div>
  );
}

function RadioRow({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
        checked
          ? "cursor-pointer border-pink-400/50 bg-pink-500/10 text-white"
          : "cursor-pointer border-white/10 bg-black/20 text-white/70 hover:bg-white/5"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-pink-400"
      />

      <span>{label}</span>
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
          className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
