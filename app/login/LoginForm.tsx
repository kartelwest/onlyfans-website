"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginIdentifier } from "@/lib/auth/loginIdentifier";
import {
  classifyAuthError,
  type LoginFailureReason,
} from "@/lib/auth/loginErrors";

type ProfileRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

export default function LoginForm({ returnTo, expired }: { returnTo?: string; expired?: boolean }) {
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("errors.login");
  const supabase = createClient();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // The REASON is held in state, not the sentence. Holding the sentence would
  // freeze it in whichever language was active when the attempt failed, so a
  // switch afterwards would leave a stale message on screen.
  const [failure, setFailure] = useState<LoginFailureReason | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setFailure(null);

    try {
      // Models may be given a plain username instead of an e-mail. Supabase
      // authenticates by e-mail only, so a username is resolved to the
      // address it was registered under before signing in.
      const resolved = resolveLoginIdentifier(identifier);

      if (!resolved.ok) {
        setFailure("invalid_identifier");
        return;
      }

      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: resolved.email,
          password,
        });

      if (loginError) {
        // A request that never reached the auth server is not a wrong
        // password, and saying so sends her to reset a password that was
        // never the problem.
        setFailure(classifyAuthError(loginError));
        return;
      }

      const user = loginData.user;

      if (!user) {
        setFailure("unknown");
        return;
      }

      // Everything below this line runs AFTER the password was accepted, so
      // these messages must never read like a credential problem. They used to
      // all collapse into one "account disabled" line, which sent an admin
      // hunting through the auth records of an account that had authenticated
      // perfectly well.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, active, must_change_password")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setFailure("no_profile");
        return;
      }

      if (!profile.active) {
        await supabase.auth.signOut();
        setFailure("account_disabled");
        return;
      }

      if (profile.must_change_password) {
        window.location.replace("/alterar-senha");
        return;
      }

      const role = profile.role as ProfileRole;

      // A login can exist without ever having been attached to a model record.
      // She would otherwise reach /area-da-modelo and meet a bare
      // "profile not found" with no idea what to do about it.
      if (role === "model") {
        const { data: linkedModel } = await supabase
          .from("models")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (!linkedModel) {
          await supabase.auth.signOut();
          setFailure("no_model_record");
          return;
        }
      }

      // "Last access" on the admin screens comes from here. Failing to record
      // it must never stand between somebody and their dashboard, so the call
      // is fire-and-forget.
      void fetch("/api/auth/record-login", { method: "POST" }).catch(() => {});

      const redirectPath = resolveRedirectPath(role, returnTo ?? null);
      window.location.replace(redirectPath);
      return;
    } catch {
      setFailure("unknown");
    } finally {
      setLoading(false);
    }
  }

  const isAmplia = isSocialMediaPortal(returnTo);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f1ec] px-6 py-12">
      <Link href="/" className="mb-8 flex items-center">
        <Image
          src="/images/karray-logo.png"
          alt="KARAY Models"
          width={240}
          height={95}
          priority
          className="h-auto w-[160px] object-contain"
        />
      </Link>

      <section className="w-full max-w-md rounded-[32px] border border-[#eadfd8] bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b06a87]">
            KARAY Models
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#4b2438]">
            {isAmplia ? t("titleAmplia") : t("title")}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#765c68]">
            {isAmplia ? t("subtitleAmplia") : t("subtitle")}
          </p>
        </div>

        {expired && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {t("sessionExpired")}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              {t("identifierLabel")}
            </label>

            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={t("identifierPlaceholder")}
              required
              className="w-full rounded-2xl border border-[#d8c7cf] bg-[#fffaf6] px-4 py-3 text-[#321725] outline-none transition focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              {t("passwordLabel")}
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("passwordPlaceholder")}
              required
              className="w-full rounded-2xl border border-[#d8c7cf] bg-[#fffaf6] px-4 py-3 text-[#321725] outline-none transition focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
            />
          </div>

          {failure && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {tErrors(failure)}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#4b2438] px-5 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#321725] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      </section>

      <Link
        href="/"
        className="mt-6 text-sm font-semibold text-[#8a6c78] transition hover:text-[#4b2438]"
      >
        {t("backToSite")}
      </Link>
    </main>
  );
}

function isSocialMediaPortal(returnTo: string | undefined): boolean {
  if (!returnTo) return false;
  return (
    returnTo.startsWith("/admin/socialmediamodels") ||
    returnTo.startsWith("/admin/amplia")
  );
}

function resolveRedirectPath(
  role: ProfileRole,
  returnTo: string | null,
): string {
  const fallback = {
    owner: "/owner",
    administrator: "/admin/models",
    representative: "/representative",
    model: "/area-da-modelo",
  }[role];

  if (returnTo && isAllowedReturnPath(role, returnTo)) {
    return returnTo;
  }

  return fallback;
}

function isAllowedReturnPath(role: ProfileRole, path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return false;
  }

  const allowedPrefixes: Record<ProfileRole, string[]> = {
    owner: ["/owner", "/admin"],
    administrator: ["/admin"],
    representative: ["/representative"],
    model: ["/area-da-modelo"],
  };

  return allowedPrefixes[role].some((prefix) => path.startsWith(prefix));
}
