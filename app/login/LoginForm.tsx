"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginIdentifier } from "@/lib/auth/loginIdentifier";
import {
  classifyAuthError,
  loginFailureMessage,
} from "@/lib/auth/loginErrors";

type ProfileRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

export default function LoginForm({ returnTo, expired }: { returnTo?: string; expired?: boolean }) {
  const supabase = createClient();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      // Models may be given a plain username instead of an e-mail. Supabase
      // authenticates by e-mail only, so a username is resolved to the
      // address it was registered under before signing in.
      const resolved = resolveLoginIdentifier(identifier);

      if (!resolved.ok) {
        throw new Error(loginFailureMessage("invalid_identifier"));
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
        throw new Error(loginFailureMessage(classifyAuthError(loginError)));
      }

      const user = loginData.user;

      if (!user) {
        throw new Error(loginFailureMessage("unknown"));
      }

      // Everything below this line runs AFTER the password was accepted, so
      // these messages must never read like a credential problem. They used to
      // all collapse into "Esta conta está desativada.", which sent an admin
      // hunting through the auth records of an account that had authenticated
      // perfectly well.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, active, must_change_password")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error(loginFailureMessage("no_profile"));
      }

      if (!profile.active) {
        await supabase.auth.signOut();
        throw new Error(loginFailureMessage("account_disabled"));
      }

      if (profile.must_change_password) {
        window.location.replace("/alterar-senha");
        return;
      }

      const role = profile.role as ProfileRole;

      // A login can exist without ever having been attached to a model record.
      // She would otherwise reach /area-da-modelo and meet a bare
      // "Perfil não encontrado" with no idea what to do about it.
      if (role === "model") {
        const { data: linkedModel } = await supabase
          .from("models")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (!linkedModel) {
          await supabase.auth.signOut();
          throw new Error(loginFailureMessage("no_model_record"));
        }
      }

      // "Último acesso" on the admin screens comes from here. Failing to
      // record it must never stand between somebody and their dashboard, so
      // the call is fire-and-forget.
      void fetch("/api/auth/record-login", { method: "POST" }).catch(() => {});

      const redirectPath = resolveRedirectPath(role, returnTo ?? null);
      window.location.replace(redirectPath);
      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : loginFailureMessage("unknown");

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

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
            {isSocialMediaPortal(returnTo) ? "Portal da Amplia" : "Portal de Acesso"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#765c68]">
            {isSocialMediaPortal(returnTo)
              ? "Entre com seu email e senha para acessar o painel da Amplia."
              : "Entre com seu email ou usuário e sua senha para acessar sua área."}
          </p>
        </div>

        {expired && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Your session expired after 8 minutes of inactivity. Please sign in again.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              Email ou usuário
            </label>

            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="seuemail@exemplo.com ou seu usuário"
              required
              className="w-full rounded-2xl border border-[#d8c7cf] bg-[#fffaf6] px-4 py-3 text-[#321725] outline-none transition focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              required
              className="w-full rounded-2xl border border-[#d8c7cf] bg-[#fffaf6] px-4 py-3 text-[#321725] outline-none transition focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
            />
          </div>

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#4b2438] px-5 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#321725] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>

      <Link
        href="/"
        className="mt-6 text-sm font-semibold text-[#8a6c78] transition hover:text-[#4b2438]"
      >
        ← Voltar para o site
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
