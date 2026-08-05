"use client";

import { useLocale, useTranslations } from "next-intl";

import { toLocale } from "@/lib/i18n/config";
import { useMoney } from "@/lib/i18n/money";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatMonthYear } from "@/lib/earnings/period";
import { USD } from "@/lib/money/currency";

type MonthlyEarning = {
  id: string;
  modelId: string;
  periodMonth: string;
  grossUsd: number;
  published: boolean;
  screenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type MonthlyEarningsPanelProps = {
  modelId: string;
};

function currentPeriodInput() {
  // Defaults to the month the model portal is currently showing — the
  // previous one — since that is the figure an admin is here to publish.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;

  return `${previousYear}-${String(previousMonth).padStart(2, "0")}`;
}

export default function MonthlyEarningsPanel({
  modelId,
}: MonthlyEarningsPanelProps) {
  const t = useTranslations("admin.monthlyEarnings");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");
  const money = useMoney();
  const locale = toLocale(useLocale());

  const [months, setMonths] = useState<MonthlyEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState(currentPeriodInput);
  const [grossUsd, setGrossUsd] = useState("");
  const [published, setPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/models/monthly-earnings?modelId=${encodeURIComponent(modelId)}`,
      );

      const data = (await response.json()) as {
        months?: MonthlyEarning[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? t("loadFailed"));
      }

      setMonths(data.months ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("modelId", modelId);
      formData.append("periodMonth", period);
      formData.append("grossUsd", grossUsd.replace(",", "."));
      formData.append("published", published ? "true" : "false");

      if (file) {
        formData.append("image", file);
      }

      const response = await fetch("/api/models/monthly-earnings", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? tErrors("saveFailed"));
      }

      setSuccessMessage(`Ganhos de ${period} salvos.`);
      setGrossUsd("");
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : tErrors("saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(month: MonthlyEarning) {
    setErrorMessage(null);

    const response = await fetch("/api/models/monthly-earnings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: month.id, published: !month.published }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !data.success) {
      setErrorMessage(data.error ?? t("publishFailed"));
      return;
    }

    await load();
  }

  function editMonth(month: MonthlyEarning) {
    setPeriod(month.periodMonth.slice(0, 7));
    setGrossUsd(String(month.grossUsd));
    setPublished(month.published);
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
      <div>
        <h3 className="text-xl font-bold">{t("title")}</h3>

        <p className="mt-1 text-sm text-white/45">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label={t("periodMonth")}>
          <input
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
          />
        </Field>

        <Field label={t("grossUsd")}>
          <input
            type="text"
            inputMode="decimal"
            value={grossUsd}
            onChange={(event) => setGrossUsd(event.target.value)}
            placeholder="1200.00"
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
          />
        </Field>

        <Field label={t("screenshot")}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
          />

          <p className="mt-1 text-[11px] text-white/35">
            {t("requiredOnFirstUpload")}
          </p>
        </Field>

        <Field label={t("visibility")}>
          <label className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
              className="h-4 w-4 accent-pink-400"
            />

            <span>{published ? t("publishToModel") : t("doNotPublish")}</span>
          </label>
        </Field>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200 disabled:opacity-50"
          >
            {saving ? tCommon("saving") : t("saveMonth")}
          </button>
        </div>
      </form>

      {errorMessage && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </p>
      )}

      <div className="mt-8">
        <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-white/45">
          {t("previousMonths")}
        </h4>

        {loading ? (
          <p className="mt-4 text-sm text-white/45">{tState("loading")}</p>
        ) : months.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">
            {t("noMonths")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {months.map((month) => (
              <li
                key={month.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                {month.screenshotUrl ? (
                  <a
                    href={month.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={month.screenshotUrl}
                      alt={t("reportFor", { month: month.periodMonth })}
                      className="h-14 w-20 rounded-lg border border-white/10 object-cover"
                    />
                  </a>
                ) : (
                  <div className="h-14 w-20 shrink-0 rounded-lg border border-dashed border-white/15" />
                )}

                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-bold">
                    {formatMonthYear(month.periodMonth, locale)}
                  </p>

                  <p className="mt-0.5 text-sm text-white/70">
                    {money.format(month.grossUsd, USD, { withCode: true })}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    month.published
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/15 bg-white/5 text-white/55"
                  }`}
                >
                  {month.published ? t("published") : t("notPublished")}
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editMonth(month)}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/5"
                  >
                    {tCommon("edit")}
                  </button>

                  <button
                    type="button"
                    onClick={() => void togglePublished(month)}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/5"
                  >
                    {month.published ? t("unpublish") : t("publish")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

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
