"use client";

import { useTranslations } from "next-intl";

import { useActionState } from "react";

import { updateRepresentativeDetails } from "../actions";

type RepresentativeDetailsFormProps = {
  representativeId: string;
  fullName: string;
  email: string;
  phone: string;
};

export default function RepresentativeDetailsForm({
  representativeId,
  fullName,
  email,
  phone,
}: RepresentativeDetailsFormProps) {
  const t = useTranslations("admin.representatives.details");
  const tCommon = useTranslations("common.actions");

  const [state, formAction, isPending] = useActionState(
    updateRepresentativeDetails,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="representativeId" value={representativeId} />

      <Field label={t("name")}>
        <input
          name="fullName"
          defaultValue={fullName}
          required
          className={inputClassName}
        />
      </Field>

      <Field label={t("email")}>
        <input
          name="email"
          type="email"
          defaultValue={email}
          placeholder="nome@karraymodels.com"
          className={inputClassName}
        />
      </Field>

      <Field label={t("phone")}>
        <input
          name="phone"
          defaultValue={phone}
          placeholder="+55 11 90000-0000"
          className={inputClassName}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-50"
        >
          {isPending ? tCommon("saving") : t("saveChanges")}
        </button>

        {state && (
          <p
            className={`text-sm ${
              state.success ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-[#1a1a1f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-pink-400/60";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>

      <div className="mt-2">{children}</div>
    </label>
  );
}
