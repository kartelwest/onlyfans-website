import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { countryCodeToFlag } from "../lib/countries";
import {
  currencyForCountry,
  currencySymbol,
  formatFxRate,
  formatMoney,
  normalizeCurrencyCode,
  resolveCurrency,
} from "../lib/money/currency";

/**
 * ICU separates a currency symbol from its digits with a NON-BREAKING space
 * (U+00A0), not the ordinary one — "US$ 1.200,00". It is invisible in a
 * diff and in an editor, so these tests spell it out rather than pasting a
 * character nobody can see. Anything comparing formatted money to a literal
 * has to account for it.
 */
const NBSP = " ";

describe("formatMoney", () => {
  it("formats USD the way the earnings card shows it in pt-BR", () => {
    assert.equal(
      formatMoney(1200, "USD", { withCode: true }),
      `US$${NBSP}1.200,00 USD`,
    );
  });

  it("formats the same USD amount the way an English reader expects", () => {
    assert.equal(
      formatMoney(1200, "USD", { withCode: true, locale: "en-US" }),
      "$1,200.00 USD",
    );
  });

  it("keeps the amount in its own currency and only changes the reader", () => {
    // The money does not convert when the language does. Same 6504 BRL, two
    // readers: grouping and symbol placement move, the currency does not.
    assert.equal(formatMoney(6504, "BRL"), `R$${NBSP}6.504,00`);
    assert.equal(formatMoney(6504, "BRL", { locale: "en-US" }), "R$6,504.00");
  });

  it("shows cents even for currencies ICU would round to whole units", () => {
    assert.equal(formatMoney(4800000, "COP"), `COP${NBSP}4.800.000,00`);
    assert.equal(
      formatMoney(4800000, "COP", { locale: "en-US" }),
      `COP${NBSP}4,800,000.00`,
    );
  });

  it("marks deductions with a minus sign", () => {
    assert.equal(
      formatMoney(92.25, "USD", { withCode: true, negative: true }),
      `−US$${NBSP}92,25 USD`,
    );
  });

  it("defaults to pt-BR when no locale is given", () => {
    assert.equal(formatMoney(1200, "USD"), formatMoney(1200, "USD", { locale: "pt-BR" }));
  });
});

describe("currencySymbol", () => {
  it("disambiguates the dollar for a Portuguese reader", () => {
    // A bare "$" in Brazil reads as the real, so ICU writes "US$" there.
    assert.equal(currencySymbol("USD"), "US$");
    assert.equal(currencySymbol("USD", "en-US"), "$");
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
    assert.equal(formatFxRate(5.42, "USD", "BRL"), `1 USD = R$${NBSP}5,42`);
  });

  it("follows the reader's number format", () => {
    assert.equal(
      formatFxRate(5.42, "USD", "BRL", "en-US"),
      "1 USD = R$5.42",
    );
  });

  it("keeps two decimals for large rates", () => {
    assert.equal(formatFxRate(4000, "USD", "COP"), `1 USD = COP${NBSP}4.000,00`);
  });
});
