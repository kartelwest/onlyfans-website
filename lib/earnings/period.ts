// Calendar helpers for the earnings card and the ledger.
//
// Two rules drive everything here:
//   * "today" is always America/São_Paulo — the agency's calendar decides when
//     a month ends and when a deduction date has been reached, not the
//     server's clock or the viewer's browser.
//   * month names come from Intl, never from a hardcoded array.

export const AGENCY_TIME_ZONE = "America/Sao_Paulo";

const LOCALE = "pt-BR";

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
export function previousMonthPeriod(now: Date = new Date()): EarningsPeriod {
  const [currentYear, currentMonth] = agencyToday(now)
    .split("-")
    .map((part) => Number(part));

  const year = currentMonth === 1 ? currentYear - 1 : currentYear;
  const month = currentMonth === 1 ? 12 : currentMonth - 1;

  const monthName = monthNamePtBr(year, month);

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

/** `2026-07-01` -> `julho`. */
export function monthNamePtBr(year: number, month: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, 1));
}

/** `2026-07-01` -> `JULHO/2026`, used by the ledger status column. */
export function formatMonthYearPtBr(isoDate: string): string {
  const [year, month] = isoDate.split("-").map((part) => Number(part));

  if (!year || !month) {
    return isoDate;
  }

  return `${monthNamePtBr(year, month).toUpperCase()}/${year}`;
}

/** `2026-07-12` -> `12/07/2026`. Dates are plain calendar dates, never UTC instants. */
export function formatDatePtBr(isoDate: string | null): string {
  if (!isoDate) {
    return "—";
  }

  const [year, month, day] = isoDate.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return isoDate;
  }

  return `${day}/${month}/${year}`;
}

/** True when `isoDate` is today or earlier in the agency timezone. */
export function isDueBy(isoDate: string, now: Date = new Date()): boolean {
  return isoDate.slice(0, 10) <= agencyToday(now);
}

/** True when the date falls inside the given `YYYY-MM-01` period. */
export function isInPeriod(isoDate: string, periodMonth: string): boolean {
  return isoDate.slice(0, 7) === periodMonth.slice(0, 7);
}
