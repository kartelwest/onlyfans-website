import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  agencyToday,
  formatDatePtBr,
  formatMonthYearPtBr,
  previousMonthPeriod,
} from "../lib/earnings/period";

describe("previousMonthPeriod", () => {
  it("names the previous month without the year inside the same year", () => {
    // 01/08/2026 00:30 in São Paulo (UTC-3).
    const period = previousMonthPeriod(new Date("2026-08-01T03:30:00Z"));

    assert.equal(period.title, "JULHO");
    assert.equal(period.monthName, "julho");
    assert.equal(period.periodMonth, "2026-07-01");
  });

  it("appends the year when the month belongs to a previous year", () => {
    const period = previousMonthPeriod(new Date("2027-01-01T12:00:00Z"));

    assert.equal(period.title, "DEZEMBRO 2026");
    assert.equal(period.periodMonth, "2026-12-01");
  });

  it("uses the São Paulo calendar, not UTC", () => {
    // 01/08/2026 00:30 UTC is still 31/07/2026 21:30 in São Paulo, so the
    // previous month is June there and July in UTC.
    const period = previousMonthPeriod(new Date("2026-08-01T00:30:00Z"));

    assert.equal(period.periodMonth, "2026-06-01");
    assert.equal(period.title, "JUNHO");
  });
});

describe("agencyToday", () => {
  it("returns the São Paulo calendar date", () => {
    assert.equal(agencyToday(new Date("2026-08-01T02:00:00Z")), "2026-07-31");
    assert.equal(agencyToday(new Date("2026-08-01T12:00:00Z")), "2026-08-01");
  });
});

describe("pt-BR date formatting", () => {
  it("formats calendar dates as DD/MM/AAAA", () => {
    assert.equal(formatDatePtBr("2026-07-12"), "12/07/2026");
    assert.equal(formatDatePtBr(null), "—");
  });

  it("formats a period as MÊS/AAAA", () => {
    assert.equal(formatMonthYearPtBr("2026-09-05"), "SETEMBRO/2026");
  });
});
