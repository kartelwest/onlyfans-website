"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      if (newPassword.length < 8) {
        throw new Error("A senha deve ter pelo menos 8 caracteres.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("As senhas não coincidem.");
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Sessão expirada. Entre novamente.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error("Erro ao atualizar senha.");
      }

      // Clear must_change_password flag
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);

      if (profileError) {
        console.error("Erro ao atualizar perfil:", profileError);
      }

      // Get role to redirect appropriately
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role;

      if (role === "owner") {
        router.replace("/owner");
      } else if (role === "administrator") {
        router.replace("/admin/models");
      } else if (role === "representative") {
        router.replace("/representative");
      } else if (role === "model") {
        router.replace("/area-da-modelo");
      } else {
        router.replace("/login");
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao alterar senha.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f1ec] px-6 py-12">
      <section className="w-full max-w-md rounded-[32px] border border-[#eadfd8] bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b06a87]">
            KARAY Models
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#4b2438]">
            Alterar Senha
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#765c68]">
            Por segurança, você precisa alterar sua senha antes de continuar.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              Nova Senha
            </label>

            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Digite sua nova senha"
              required
              minLength={8}
              className="w-full rounded-2xl border border-[#d8c7cf] bg-[#fffaf6] px-4 py-3 text-[#321725] outline-none transition focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              Confirmar Senha
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirme sua nova senha"
              required
              minLength={8}
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
            {loading ? "Alterando..." : "Alterar Senha"}
          </button>
        </form>
      </section>
    </main>
  );
}
