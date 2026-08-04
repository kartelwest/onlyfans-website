// Calendar helpers for the earnings card and the ledger.
//
// Three rules drive everything here:
//   * "today" is always America/São_Paulo — the agency's calendar decides when
//     a month ends and when a deduction date has been reached, not the
//     server's clock or the viewer's browser.
//   * month names come from Intl, never from a hardcoded array.
//   * a date here is a plain CALENDAR date, never a UTC instant. `2026-09-05`
//     is the 5th of September wherever it is read, so the parts are split out
//     of the string and reordered rather than being fed through a Date, which
//     would land on the 4th for anyone west of UTC.
//
// The locale argument only ever changes how a date READS — never which day it
// is. It defaults to pt-BR so a caller outside a request still gets the
// product's first language.

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export const AGENCY_TIME_ZONE = "America/Sao_Paulo";

/** Today in the agency's timezone as `YYYY-MM-DD`. */
export function agencyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENCY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type EarningsPeriod = {
  /** First day of the month, `YYYY-MM-01` — matches `period_month`. */
  periodMonth: string;
  year: number;
  /** 1-12. */
  month: number;
  /** `JULHO`, or `DEZEMBRO 2025` when the month belongs to a past year. */
  title: string;
  /** `julho` — for inline prose such as "Descontos de julho". */
  monthName: string;
};

/**
 * The previous calendar month, computed in the agency timezone. The year is
 * appended only when the previous month falls in an earlier year, so on
 * 01/08/2026 this is `JULHO` and on 01/01/2027 it is `DEZEMBRO 2026`.
 */
export function previousMonthPeriod(
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): EarningsPeriod {
  const [currentYear, currentMonth] = agencyToday(now)
    .split("-")
    .map((part) => Number(part));

  const year = currentMonth === 1 ? currentYear - 1 : currentYear;
  const month = currentMonth === 1 ? 12 : currentMonth - 1;

  const monthName = monthName_(year, month, locale);

  return {
    periodMonth: toPeriodMonth(year, month),
    year,
    month,
    title:
      year === currentYear
        ? monthName.toUpperCase()
        : `${monthName.toUpperCase()} ${year}`,
    monthName,
  };
}

export function toPeriodMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** `2026-07-01` -> `julho` / `July`. */
export function monthName_(
  year: number,
  month: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, 1));
}

/** @deprecated Use `monthName_(year, month, locale)`. */
export const monthNamePtBr = monthName_;

/** `2026-07-01` -> `JULHO/2026` / `JULY/2026`, used by the ledger status column. */
export function formatMonthYear(
  isoDate: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const [year, month] = isoDate.split("-").map((part) => Number(part));

  if (!year || !month) {
    return isoDate;
  }

  return `${monthName_(year, month, locale).toUpperCase()}/${year}`;
}

/** @deprecated Use `formatMonthYear(isoDate, locale)`. */
export const formatMonthYearPtBr = formatMonthYear;

/**
 * `2026-07-12` -> `12/07/2026` in pt-BR, `07/12/2026` in en-US.
 *
 * Built by reordering the string's own parts, so the day never shifts.
 */
export function formatCalendarDate(
  isoDate: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!isoDate) {
    return "—";
  }

  const [year, month, day] = isoDate.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return isoDate;
  }

  return locale === "en-US"
    ? `${month}/${day}/${year}`
    : `${day}/${month}/${year}`;
}

/** @deprecated Use `formatCalendarDate(isoDate, locale)`. */
export const formatDatePtBr = formatCalendarDate;

/** True when `isoDate` is today or earlier in the agency timezone. */
export function isDueBy(isoDate: string, now: Date = new Date()): boolean {
  return isoDate.slice(0, 10) <= agencyToday(now);
}

/** True when the date falls inside the given `YYYY-MM-01` period. */
export function isInPeriod(isoDate: string, periodMonth: string): boolean {
  return isoDate.slice(0, 7) === periodMonth.slice(0, 7);
}
