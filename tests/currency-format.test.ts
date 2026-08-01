import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { countryCodeToFlag } from "../lib/countries";
import {
  currencyForCountry,
  formatFxRate,
  formatMoney,
  normalizeCurrencyCode,
  resolveCurrency,
} from "../lib/money/currency";

describe("formatMoney", () => {
  it("formats USD the way the earnings card shows it", () => {
    assert.equal(
      formatMoney(1200, "USD", { withCode: true }),
      "$1.200,00 USD",
    );
  });

  it("formats the model's own currency without hardcoding BRL", () => {
    assert.equal(formatMoney(6504, "BRL"), "R$ 6.504,00");
    assert.equal(formatMoney(4800000, "COP"), "$4.800.000,00");
  });

  it("marks deductions with a minus sign", () => {
    assert.equal(
      formatMoney(92.25, "USD", { withCode: true, negative: true }),
      "−$92,25 USD",
    );
  });
});

describe("currency codes", () => {
  it("normalizes free-text values that look like ISO codes", () => {
    assert.equal(normalizeCurrencyCode("Brl"), "BRL");
    assert.equal(normalizeCurrencyCode(" usd "), "USD");
  });

  it("rejects anything that is not a code", () => {
    assert.equal(normalizeCurrencyCode("R$"), null);
    assert.equal(normalizeCurrencyCode("Real"), null);
    assert.equal(normalizeCurrencyCode(null), null);
  });

  it("falls back to USD, the currency earnings are stored in", () => {
    assert.equal(resolveCurrency("R$"), "USD");
    assert.equal(resolveCurrency("COP"), "COP");
  });

  it("defaults the currency from the country", () => {
    assert.equal(currencyForCountry("BR"), "BRL");
    assert.equal(currencyForCountry("CO"), "COP");
    assert.equal(currencyForCountry(null), "USD");
  });
});

describe("flags", () => {
  it("derives the emoji from the country code", () => {
    assert.equal(countryCodeToFlag("BR"), "🇧🇷");
    assert.equal(countryCodeToFlag("CO"), "🇨🇴");
  });
});

describe("formatFxRate", () => {
  it("reads as 1 USD = R$ 5,42", () => {
    assert.equal(formatFxRate(5.42, "USD", "BRL"), "1 USD = R$ 5,42");
  });

  it("keeps two decimals for large rates", () => {
    assert.equal(formatFxRate(4000, "USD", "COP"), "1 USD = $4.000,00");
  });
});
