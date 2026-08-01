import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { agencyToday } from "@/lib/earnings/period";
import { resolveCurrency } from "@/lib/money/currency";

// FX is fetched server-side only and cached one row per (pair, day) in
// `fx_rates`. Two different rate dates exist in this feature and they are never
// interchangeable:
//   * the display rate — today's — converts the USD earnings figure into the
//     model's own currency, and moves every day;
//   * the deduction rate — the entry's `deduct_on` — is snapshotted onto the
//     ledger row and frozen, so a past month's payout never changes.

const FRANKFURTER_ENDPOINT = "https://api.frankfurter.app";
const FETCH_TIMEOUT_MS = 5000;

export type FxRate = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  /** The day the returned rate is actually for. */
  rateDate: string;
  /** True when the rate is a fallback: the live fetch failed for `rateDate`. */
  stale: boolean;
};

type FrankfurterResponse = {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

function identityRate(currency: string, date: string): FxRate {
  return {
    baseCurrency: currency,
    quoteCurrency: currency,
    rate: 1,
    rateDate: date,
    stale: false,
  };
}

async function readCachedRate(
  supabase: SupabaseClient,
  base: string,
  quote: string,
  date: string,
): Promise<FxRate | null> {
  const { data } = await supabase
    .from("fx_rates")
    .select("rate, rate_date")
    .eq("base_currency", base)
    .eq("quote_currency", quote)
    .eq("rate_date", date)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    baseCurrency: base,
    quoteCurrency: quote,
    rate: Number(data.rate),
    rateDate: data.rate_date as string,
    stale: false,
  };
}

/**
 * The most recent cached rate at or before `date`, falling back to the most
 * recent one overall. Used when the API is unavailable — the caller labels the
 * figure with `rateDate` so a model always sees which day her rate is from.
 */
async function readNearestCachedRate(
  supabase: SupabaseClient,
  base: string,
  quote: string,
  date: string,
): Promise<FxRate | null> {
  const before = await supabase
    .from("fx_rates")
    .select("rate, rate_date")
    .eq("base_currency", base)
    .eq("quote_currency", quote)
    .lte("rate_date", date)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row =
    before.data ??
    (
      await supabase
        .from("fx_rates")
        .select("rate, rate_date")
        .eq("base_currency", base)
        .eq("quote_currency", quote)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;

  if (!row) {
    return null;
  }

  return {
    baseCurrency: base,
    quoteCurrency: quote,
    rate: Number(row.rate),
    rateDate: row.rate_date as string,
    stale: true,
  };
}

async function fetchRate(
  base: string,
  quote: string,
  date: string,
): Promise<number | null> {
  try {
    const response = await fetch(
      `${FRANKFURTER_ENDPOINT}/${date}?from=${base}&to=${quote}`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as FrankfurterResponse;
    const rate = payload.rates?.[quote];

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    return rate;
  } catch (error) {
    console.error(
      `Falha ao consultar câmbio ${base}->${quote} em ${date}:`,
      error,
    );

    return null;
  }
}

/**
 * The rate for one pair on one day, cached in `fx_rates`.
 *
 * `supabase` must be a service-role client: the cache is written server-side
 * and `fx_rates` has no INSERT policy for `authenticated`.
 */
export async function getFxRate(
  supabase: SupabaseClient,
  baseCurrency: string,
  quoteCurrency: string,
  date: string,
  now: Date = new Date(),
): Promise<FxRate | null> {
  const base = resolveCurrency(baseCurrency);
  const quote = resolveCurrency(quoteCurrency);

  if (base === quote) {
    return identityRate(base, date);
  }

  // The API has no rates for the future; a future-dated deduction is only ever
  // shown as an estimate at today's rate.
  const today = agencyToday(now);
  const effectiveDate = date > today ? today : date;

  const cached = await readCachedRate(supabase, base, quote, effectiveDate);

  if (cached) {
    return cached;
  }

  const fetched = await fetchRate(base, quote, effectiveDate);

  if (fetched === null) {
    return readNearestCachedRate(supabase, base, quote, effectiveDate);
  }

  // Stored under the requested date so the pair is fetched at most once a day,
  // even when the API answered with the previous business day's fixing.
  const { error } = await supabase.from("fx_rates").insert({
    base_currency: base,
    quote_currency: quote,
    rate: fetched,
    rate_date: effectiveDate,
  });

  if (error && error.code !== "23505") {
    console.error("Falha ao gravar o câmbio em cache:", error);
  }

  return {
    baseCurrency: base,
    quoteCurrency: quote,
    rate: fetched,
    rateDate: effectiveDate,
    stale: false,
  };
}

/** Same as {@link getFxRate}, for several dates of one pair. */
export async function getFxRatesForDates(
  supabase: SupabaseClient,
  baseCurrency: string,
  quoteCurrency: string,
  dates: string[],
  now: Date = new Date(),
): Promise<Map<string, FxRate>> {
  const unique = Array.from(new Set(dates));
  const results = new Map<string, FxRate>();

  for (const date of unique) {
    const rate = await getFxRate(
      supabase,
      baseCurrency,
      quoteCurrency,
      date,
      now,
    );

    if (rate) {
      results.set(date, rate);
    }
  }

  return results;
}
