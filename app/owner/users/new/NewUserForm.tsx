"use client";

import { useTranslations } from "next-intl";

import { useActionState } from "react";
import Link from "next/link";

import {
  createUserAction,
  type CreateUserState,
} from "./actions";

type UserRole = "model" | "administrator" | "representative";

type RepresentativeOption = {
  id: string;
  fullName: string;
  role: string;
};

type NewUserFormProps = {
  role: UserRole;
  representatives: RepresentativeOption[];
};

const initialState: CreateUserState = {
  success: false,
  message: "",
};

export default function NewUserForm({
  role,
  representatives,
}: NewUserFormProps) {
  const t = useTranslations("owner.newUser");

  const [state, formAction, pending] = useActionState(
    createUserAction,
    initialState,
  );

  const isModel = role === "model";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="role" value={role} />

      <div>
        <label
          htmlFor="fullName"
          className="mb-2 block text-sm font-semibold text-zinc-200"
        >
          {t("fullName")}
        </label>

        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
          placeholder={t("fullNamePlaceholder")}
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-semibold text-zinc-200"
        >
          {t("email")}
        </label>

        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
          placeholder={t("emailPlaceholder")}
        />
      </div>

      {isModel && (
        <div>
          <label
            htmlFor="whatsapp"
            className="mb-2 block text-sm font-semibold text-zinc-200"
          >
            {t("whatsapp")}
          </label>

          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
            placeholder={t("whatsappPlaceholder")}
          />

          <p className="mt-2 text-xs text-zinc-500">
            {t("passwordFromWhatsApp")}
          </p>
        </div>
      )}

      {isModel && (
        <div>
          <label
            htmlFor="representativeId"
            className="mb-2 block text-sm font-semibold text-zinc-200"
          >
            {t("representative")}
          </label>

          <select
            id="representativeId"
            name="representativeId"
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-pink-400"
          >
            <option value="">{t("selectRepresentative")}</option>

            {representatives.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.fullName}
                {rep.role === "owner"
                  ? " (Proprietário)"
                  : rep.role === "administrator"
                    ? " (Administrador)"
                    : " (Representante)"}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-zinc-500">
            {t("representativeNotFound")}{" "}
            <Link
              href="/owner/users/new?role=representative"
              className="text-pink-400 underline transition hover:text-pink-300"
            >
              {t("registerNew")}
            </Link>
          </p>
        </div>
      )}

      {!isModel && (
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-semibold text-zinc-200"
          >
            {t("temporaryPassword")}
          </label>

          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={6}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
            placeholder={t("temporaryPasswordPlaceholder")}
          />
        </div>
      )}

      {state.message && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            state.success
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <p className="font-semibold">{state.message}</p>

          {state.success && state.temporaryPassword && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wider text-green-200/70">
                {t("temporaryPassword")}
              </p>

              <p className="mt-1 text-lg font-bold">
                {state.temporaryPassword}
              </p>

              <p className="mt-2 text-xs text-green-200/70">
                {t("savePasswordWarning")}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-pink-400 px-5 py-3 font-bold text-black transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}