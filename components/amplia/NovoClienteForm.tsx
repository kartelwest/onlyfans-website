"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NovoClienteForm() {
  const t = useTranslations("admin.amplia.newClient");
  const tErrors = useTranslations("errors");

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      stageName: String(formData.get("stageName")),
      displayName: String(formData.get("displayName")),
      email: String(formData.get("email")),
      whatsapp: String(formData.get("whatsapp")),
      location: String(formData.get("location")),
      nationality: String(formData.get("nationality")),
      brandCategory: String(formData.get("brandCategory")),
      niche1: String(formData.get("niche1")),
      niche2: String(formData.get("niche2")),
      niche3: String(formData.get("niche3")),
      primaryPositioning: String(formData.get("primaryPositioning")),
      secondaryPositioning: String(formData.get("secondaryPositioning")),
      aiGuidance: String(formData.get("aiGuidance")),
    };

    try {
      const res = await fetch("/api/brand/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await res.json()) as { id?: string; error?: string };

      if (!res.ok || result.error) {
        throw new Error(result.error ?? t("createFailed"));
      }

      router.push(`/admin/socialmediamodels/models/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#111115] p-6">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={t("fields.stageName")} name="stageName" required />
          <Field label={t("fields.displayName")} name="displayName" required />
          <Field label={t("fields.email")} name="email" type="email" />
          <Field label={t("fields.whatsapp")} name="whatsapp" />
          <Field label={t("fields.city")} name="location" />
          <Field label={t("fields.nationality")} name="nationality" />
          <Field label={t("fields.brandCategory")} name="brandCategory" />
          <Field label={t("fields.niche1")} name="niche1" required />
          <Field label={t("fields.niche2")} name="niche2" />
          <Field label={t("fields.niche3")} name="niche3" />
          <Field label={t("fields.primaryPositioning")} name="primaryPositioning" />
          <Field label={t("fields.secondaryPositioning")} name="secondaryPositioning" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white/70">
            {t("fields.aiGuidance")}
          </label>
          <textarea
            name="aiGuidance"
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-[#1a1a1f] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
            placeholder={t("aiGuidancePlaceholder")}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-60"
          >
            {loading ? t("creating") : t("create")}
          </button>
        </div>
      </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-white/70">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-[#1a1a1f] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
      />
    </div>
  );
}
