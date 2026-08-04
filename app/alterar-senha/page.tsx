"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/** Which sentence to show. Held as a key so a language switch re-renders it. */
type ChangePasswordError =
  | "tooShort"
  | "mismatch"
  | "sessionExpired"
  | "updateFailed"
  | "unknown";

export default function ChangePasswordPage() {
  const t = useTranslations("auth.changePasswordPage");
  const supabase = createClient();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [failure, setFailure] = useState<ChangePasswordError | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setFailure(null);

    try {
      if (newPassword.length < 8) {
        setFailure("tooShort");
        return;
      }

      if (newPassword !== confirmPassword) {
        setFailure("mismatch");
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setFailure("sessionExpired");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setFailure("updateFailed");
        return;
      }

      // Clear must_change_password flag
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);

      if (profileError) {
        console.error("Failed to clear must_change_password:", profileError);
      }

      // Get role to redirect appropriately
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role;

      if (role === "owner") {
        window.location.replace("/owner");
      } else if (role === "administrator") {
        window.location.replace("/admin/models");
      } else if (role === "representative") {
        window.location.replace("/representative");
      } else if (role === "model") {
        window.location.replace("/area-da-modelo");
      } else {
        window.location.replace("/login");
      }
    } catch {
      setFailure("unknown");
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
            {t("title")}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#765c68]">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-sm font-semibold text-[#4b2438]"
            >
              {t("newPasswordLabel")}
            </label>

            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t("newPasswordPlaceholder")}
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
              {t("confirmPasswordLabel")}
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              required
              minLength={8}
              className="w-full rounded-2xl border border-[#d8c7cf] bg-[#fffaf6] px-4 py-3 text-[#321725] outline-none transition focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
            />
          </div>

          {failure && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {t(`errors.${failure}`)}
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
    </main>
  );
}
