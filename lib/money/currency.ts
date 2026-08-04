// Currency + money formatting shared by the model portal and the admin panels.
//
// Two things this deliberately does NOT do:
//   - hardcode BRL. A Brazilian model is only the common case, so every amount
//     is rendered from the model's own ISO 4217 code.
//   - hardcode a locale. The same USD figure reads "US$ 1.234,56" to a
//     Portuguese reader and "$1,234.56" to an English one. The currency is a
//     property of the money; the grouping, the decimal mark and the placement
//     of the symbol are properties of the reader.
//
// The locale argument therefore threads through every function here. It
// defaults to pt-BR so that a caller outside a request context — a script, a
// test, a server job — still gets the product's first language rather than
// whatever ICU decides.

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export const USD = "USD";
export const BRL = "BRL";

// Fallback when a model has no currency set, or has a value that predates the
// ISO-code normalization. USD is the currency earnings are stored in, so it is
// the one display that can never be wrong by more than a missing conversion.
export const FALLBACK_CURRENCY = USD;

// Currency by country of residence. This only seeds the admin form when a
// country is picked — `preferred_currency` stays admin-editable afterwards, so
// an unlisted country simply defaults to USD rather than blocking anything.
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  AR: "ARS", AT: "EUR", AU: "AUD", BE: "EUR", BO: "BOB", BR: "BRL",
  CA: "CAD", CH: "CHF", CL: "CLP", CO: "COP", CR: "CRC", CU: "CUP",
  CZ: "CZK", DE: "EUR", DK: "DKK", DO: "DOP", EC: "USD", ES: "EUR",
  FI: "EUR", FR: "EUR", GB: "GBP", GR: "EUR", GT: "GTQ", HN: "HNL",
  HU: "HUF", ID: "IDR", IE: "EUR", IL: "ILS", IN: "INR", IT: "EUR",
  JP: "JPY", KE: "KES", MX: "MXN", MY: "MYR", NG: "NGN", NI: "NIO",
  NL: "EUR", NO: "NOK", NZ: "NZD", PA: "PAB", PE: "PEN", PH: "PHP",
  PL: "PLN", PT: "EUR", PY: "PYG", RO: "RON", RU: "RUB", SE: "SEK",
  SG: "SGD", SV: "USD", TH: "THB", TR: "TRY", UA: "UAH", US: "USD",
  UY: "UYU", VE: "VES", VN: "VND", ZA: "ZAR",
};

/** Every currency the admin form offers, plus whatever a model already has. */
export const SUPPORTED_CURRENCIES: string[] = Array.from(
  new Set([USD, BRL, "EUR", ...Object.values(CURRENCY_BY_COUNTRY)]),
).sort();

export function currencyForCountry(countryCode: string | null): string {
  if (!countryCode) {
    return FALLBACK_CURRENCY;
  }

  return CURRENCY_BY_COUNTRY[countryCode.toUpperCase()] ?? FALLBACK_CURRENCY;
}

/**
 * `preferred_currency` was free text before the ledger migration, so anything
 * that is not a plausible ISO 4217 code is treated as "not set" rather than
 * handed to Intl, which throws on a malformed code.
 */
export function normalizeCurrencyCode(
  value: string | null | undefined,
): string | null {
  const normalized = (value ?? "").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return null;
  }

  try {
    new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency: normalized,
    });
  } catch {
    return null;
  }

  return normalized;
}

export function resolveCurrency(value: string | null | undefined): string {
  return normalizeCurrencyCode(value) ?? FALLBACK_CURRENCY;
}

const symbolCache = new Map<string, string>();

/**
 * The symbol as the READER's locale writes it. A Portuguese reader sees `US$`
 * for dollars, because in Brazil a bare `$` is ambiguous with the real; an
 * English reader sees `$`, because there it is not.
 *
 * Used for input adornments, where a symbol has to stand alone next to a field.
 * Formatted amounts should go through `formatMoney` instead.
 */
export function currencySymbol(
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const code = resolveCurrency(currency);
  const cacheKey = `${locale}:${code}`;
  const cached = symbolCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
  }).formatToParts(0);

  const symbol = parts.find((part) => part.type === "currency")?.value ?? code;

  symbolCache.set(cacheKey, symbol);

  return symbol;
}

export type FormatMoneyOptions = {
  /** Append the ISO code, as the earnings card does: `US$ 1.200,00 USD`. */
  withCode?: boolean;
  /** Render `−` in front of the amount (deduction lines). */
  negative?: boolean;
  /** The reader's language. Defaults to the product's first language. */
  locale?: Locale;
};

/**
 * Two fraction digits always, even for currencies ICU would round to whole
 * units (COP, JPY). Amounts are stored to the cent and the ledger reconciles to
 * the cent, so hiding them would make a total stop adding up on screen.
 */
export function formatMoney(
  amount: number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const code = resolveCurrency(currency);

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount) || 0);

  const sign = options.negative ? "−" : "";
  const suffix = options.withCode ? ` ${code}` : "";

  return `${sign}${formatted}${suffix}`;
}

/**
 * `1 USD = R$ 5,42`. Currencies with large unit values (COP, VND…) need more
 * than two decimals to stay meaningful in the other direction, so the
 * precision follows the magnitude of the rate.
 */
export function formatFxRate(
  rate: number,
  baseCurrency: string,
  quoteCurrency: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const quote = resolveCurrency(quoteCurrency);

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: quote,
    minimumFractionDigits: 2,
    maximumFractionDigits: rate >= 100 ? 2 : 4,
  }).format(rate);

  return `1 ${resolveCurrency(baseCurrency)} = ${formatted}`;
}
