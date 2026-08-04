"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import { countryCodeToFlag, listCountries } from "@/lib/countries";
import {
  SUPPORTED_CURRENCIES,
  currencyForCountry,
  resolveCurrency,
} from "@/lib/money/currency";

import type { Model } from "@/types/model";

type FinancialSettingsSectionProps = {
  model: Model;
  onModelUpdate: (model: Model) => void;
};

const countries = listCountries();

/**
 * Country, currency and the expenses/loans eligibility flag.
 *
 * The checkbox is the single source of truth for the ledger feature: picking
 * Brazil pre-checks it on a model that has never had it set, but it stays
 * overridable both ways and nothing at runtime branches on the country.
 */
export default function FinancialSettingsSection({
  model,
  onModelUpdate,
}: FinancialSettingsSectionProps) {
  const t = useTranslations("admin.financial");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<{
    entryCount: number;
    base: Model;
  } | null>(null);

  async function updateField(
    field: "countryCode" | "preferredCurrency",
    value: string,
  ) {
    setSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/models/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id, field, value }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? tErrors("saveFailed"));
      }

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : tErrors("saveFailed"),
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleCountryChange(countryCode: string) {
    const saved = await updateField("countryCode", countryCode);

    if (!saved) {
      return;
    }

    let currency = model.preferredCurrency;

    // Seed the currency from the country only when there is nothing to
    // overwrite — an explicit choice is never replaced.
    if (!currency && countryCode) {
      currency = currencyForCountry(countryCode);
      await updateField("preferredCurrency", currency);
    }

    const updated: Model = {
      ...model,
      countryCode: countryCode || null,
      preferredCurrency: currency,
    };

    onModelUpdate(updated);

    // Pre-check the ledger flag when a model gets Brazil as her first country.
    // It stays a normal checkbox afterwards — this never forces it back on.
    if (countryCode === "BR" && !model.countryCode && !model.expensesEnabled) {
      await requestToggleExpenses(true, updated);
    }
  }

  /**
   * Turning the ledger off on a model who already has entries asks first — in
   * the page, never through window.confirm, which a mobile in-app browser may
   * suppress (a suppressed confirm reads as "cancel", so the switch would
   * silently snap back).
   */
  async function requestToggleExpenses(enabled: boolean, base: Model = model) {
    if (enabled) {
      await toggleExpenses(true, base);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const countResponse = await fetch(
        `/api/models/expenses-enabled?modelId=${encodeURIComponent(model.id)}`,
      );

      const countData = (await countResponse.json()) as {
        entryCount?: number;
        error?: string;
      };

      if (!countResponse.ok) {
        throw new Error(
          countData.error ?? t("entriesReadFailed"),
        );
      }

      const entryCount = countData.entryCount ?? 0;

      if (entryCount > 0) {
        setPendingDisable({ entryCount, base });
        return;
      }

      await toggleExpenses(false, base);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : tErrors("saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpenses(enabled: boolean, base: Model = model) {
    setSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/models/expenses-enabled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id, enabled }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? tErrors("saveFailed"));
      }

      onModelUpdate({ ...base, expensesEnabled: enabled });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : tErrors("saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  const currencyOptions = Array.from(
    new Set(
      [
        ...SUPPORTED_CURRENCIES,
        model.preferredCurrency ? resolveCurrency(model.preferredCurrency) : "",
      ].filter(Boolean),
    ),
  ).sort();

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
      <div>
        <h3 className="text-xl font-bold">{t("title")}</h3>

        <p className="mt-1 text-sm text-white/45">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
            {t("country")}
          </span>

          <select
            value={model.countryCode ?? ""}
            disabled={saving}
            onChange={(event) => void handleCountryChange(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300 disabled:opacity-50"
          >
            <option value="">{tState("notInformed")}</option>

            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {countryCodeToFlag(country.code)} {country.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
            {t("currency")}
          </span>

          <select
            value={
              model.preferredCurrency
                ? resolveCurrency(model.preferredCurrency)
                : ""
            }
            disabled={saving}
            onChange={async (event) => {
              const value = event.target.value;

              if (await updateField("preferredCurrency", value)) {
                onModelUpdate({ ...model, preferredCurrency: value || null });
              }
            }}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300 disabled:opacity-50"
          >
            <option value="">{t("currencyDefault")}</option>

            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <input
          type="checkbox"
          checked={model.expensesEnabled}
          disabled={saving}
          onChange={(event) =>
            void requestToggleExpenses(event.target.checked)
          }
          className="mt-0.5 h-4 w-4 accent-pink-400"
        />

        <span>
          <span className="block text-sm font-bold">
            {t("expensesToggle")}
          </span>

          <span className="mt-1 block text-xs text-white/45">
            {t("expensesToggleHint")}
          </span>
        </span>
      </label>

      {errorMessage && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      <ConfirmDialog
        open={pendingDisable !== null}
        title={t("disableTitle")}
        description={
          <>
            <p>
              {t("disableBody", {
                count: pendingDisable?.entryCount ?? 0,
              })}
            </p>
            <p>{t("disableEffect")}</p>
          </>
        }
        confirmLabel={t("disable")}
        busyLabel={tCommon("saving")}
        busy={saving}
        onCancel={() => setPendingDisable(null)}
        onConfirm={() => {
          const pending = pendingDisable;
          setPendingDisable(null);

          if (pending) {
            void toggleExpenses(false, pending.base);
          }
        }}
      />
    </section>
  );
}
