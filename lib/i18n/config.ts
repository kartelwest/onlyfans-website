/**
 * The locale vocabulary, shared by server and client.
 *
 * This module is deliberately free of Next.js and Supabase imports so that it
 * can be pulled into a client bundle, a server component, a route handler or
 * the standalone `i18n:check` script without dragging a runtime along with it.
 */

export const LOCALES = ["pt-BR", "en-US"] as const;

export type Locale = (typeof LOCALES)[number];

/** Brazilian Portuguese is the product's first language, not a fallback. */
export const DEFAULT_LOCALE: Locale = "pt-BR";

/** The cookie next-intl and the switcher agree on. One year, path-wide. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Every timestamp in this product is a Brazilian business fact — a payout date,
 * a note written in São Paulo. Pinning the zone keeps a date from sliding a day
 * when the server renders in UTC and the browser re-renders in another zone,
 * which is also what would produce a hydration mismatch.
 */
export const TIME_ZONE = "America/Sao_Paulo";

/** What the switcher draws for each locale. */
export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português",
  "en-US": "English",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  "pt-BR": "/flags/br.svg",
  "en-US": "/flags/us.svg",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Narrows anything to a supported locale. An unknown or absent value is not an
 * error worth surfacing — it just means "show them Portuguese".
 */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
