"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import {
  type FormatMoneyOptions,
  currencySymbol,
  formatFxRate,
  formatMoney,
} from "@/lib/money/currency";

import { toLocale } from "./config";

/**
 * The money formatters, bound to the language the reader is currently in.
 *
 * Exists so that a component never has to remember to thread a locale through
 * every call — `const money = useMoney()` and then `money(amount, currency)`
 * reads the same as the old locale-blind helper did, but follows the switcher.
 */
export function useMoney() {
  const locale = toLocale(useLocale());

  return useMemo(
    () => ({
      /** `US$ 1.234,56` in pt-BR, `$1,234.56` in en-US. */
      format: (
        amount: number,
        currency: string,
        options: Omit<FormatMoneyOptions, "locale"> = {},
      ) => formatMoney(amount, currency, { ...options, locale }),

      /** `1 USD = R$ 5,42`. */
      fxRate: (rate: number, base: string, quote: string) =>
        formatFxRate(rate, base, quote, locale),

      /** Just the symbol, for input adornments. */
      symbol: (currency: string) => currencySymbol(currency, locale),

      locale,
    }),
    [locale],
  );
}
