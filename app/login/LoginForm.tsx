"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ProfileRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

export default function LoginForm({ returnTo }: { returnTo?: string }) {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw new Error("Email ou senha incorretos.");
      }

      const user = loginData.user;

      if (!user) {
        throw new Error("Não foi possível acessar esta conta.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, active, must_change_password")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error("Perfil de acesso não encontrado.");
      }

      if (!profile.active) {
        await supabase.auth.signOut();
        throw new Error("Esta conta está desativada.");
      }

      if (profile.must_change_password) {
        window.location.replace("/alterar-senha");
        return;
      }

      const role = profile.role as ProfileRole;

      const redirectPath = resolveRedirectPath(role, returnTo ?? null);
      window.location.replace(redirectPath);
      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao entrar.";

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
            {returnTo?.startsWith("/admin/amplia") ? "Portal da Amplia" : "Portal de Acesso"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#765c68]">
            {returnTo?.startsWith("/admin/amplia")
              ? "Entre com seu email e senha para acessar o painel de crescimento de marca e mídia social."
              : "Entre com seu email e senha para acessar sua área."}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
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
