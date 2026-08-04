import { DEFAULT_LOCALE, TIME_ZONE, type Locale } from "@/lib/i18n/config";

/**
 * A timestamp in the reader's language, always in São Paulo time.
 *
 * The zone is pinned rather than taken from the viewer's machine: these are
 * Brazilian business facts — when a payout was recorded, when a note was
 * written — and an admin travelling through another zone should still see the
 * hour the office saw. Pinning it is also what stops a date rendered on the
 * server from disagreeing with the same date re-rendered in the browser, which
 * is the usual source of a hydration warning on a timestamp.
 *
 * Only the ORDER of the fields follows the locale: 09/03/2026 14:05 for a
 * Portuguese reader, 03/09/2026 14:05 for an English one.
 */
export function formatDateTime(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const day = get("day");
  const month = get("month");

  // en-US orders month before day; pt-BR the other way round. Reading the two
  // parts back out of ICU and re-joining them keeps the separator and the
  // 24-hour clock identical in both, so only the order changes.
  const date_ =
    locale === "en-US" ? `${month}/${day}/${get("year")}` : `${day}/${month}/${get("year")}`;

  return `${date_} ${get("hour")}:${get("minute")}`;
}

/**
 * The original name, kept so the many existing call sites keep compiling.
 * Renders in pt-BR unless a locale is passed.
 *
 * @deprecated Prefer `formatDateTime(date, locale)` with the reader's locale.
 */
export function formatBrazilDateTime(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatDateTime(date, locale);
}
