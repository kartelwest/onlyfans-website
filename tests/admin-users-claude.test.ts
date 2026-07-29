import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  generateTemporaryPassword,
  normalizeCountry,
  normalizeDateOfBirth,
  normalizeEmail,
  normalizeExtractedModelData,
  normalizeName,
  normalizePhone,
} from "../lib/admin/modelOnboardingHelpers";

describe("Model onboarding helpers", () => {
  describe("normalizeName", () => {
    it("trims and collapses whitespace while preserving accents", () => {
      const result = normalizeName("  Ana   Lúcia  Mendonça  ");

      assert.equal(result, "Ana Lúcia Mendonça");
    });

    it("returns null for empty strings", () => {
      assert.equal(normalizeName("   "), null);
    });

    it("ignores non-string values", () => {
      assert.equal(normalizeName(null as unknown as string), null);
      assert.equal(normalizeName(123 as unknown as string), null);
    });
  });

  describe("normalizeEmail", () => {
    it("trims and lowercases valid emails", () => {
      const result = normalizeEmail("  Ana@Exemplo.COM  ");

      assert.equal(result.value, "ana@exemplo.com");
      assert.equal(result.valid, true);
    });

    it("rejects invalid emails", () => {
      const result = normalizeEmail("not-an-email");

      assert.equal(result.value, "not-an-email");
      assert.equal(result.valid, false);
    });

    it("returns null for empty values", () => {
      const result = normalizeEmail("   ");

      assert.equal(result.value, null);
      assert.equal(result.valid, false);
    });
  });

  describe("normalizePhone", () => {
    it("strips formatting and preserves country code", () => {
      const result = normalizePhone("+55 21 99999-4321");

      assert.equal(result.normalized, "+5521999994321");
      assert.equal(result.digits, "5521999994321");
      assert.equal(result.valid, true);
    });

    it("handles plain digits", () => {
      const result = normalizePhone("21992120000");

      assert.equal(result.normalized, "21992120000");
      assert.equal(result.digits, "21992120000");
      assert.equal(result.valid, true);
    });

    it("rejects numbers with too few digits", () => {
      const result = normalizePhone("1234567");

      assert.equal(result.normalized, "1234567");
      assert.equal(result.digits, "1234567");
      assert.equal(result.valid, false);
    });
  });

  describe("normalizeDateOfBirth", () => {
    it("returns ISO date for DD/MM/AAAA", () => {
      const result = normalizeDateOfBirth("15/03/1995");

      assert.equal(result.value, "1995-03-15");
      assert.equal(result.ambiguous, false);
    });

    it("returns ISO date for YYYY-MM-DD", () => {
      const result = normalizeDateOfBirth("1995-03-15");

      assert.equal(result.value, "1995-03-15");
      assert.equal(result.ambiguous, false);
    });

    it("marks ambiguous dates as null", () => {
      const result = normalizeDateOfBirth("02/03/1995");

      assert.equal(result.value, null);
      assert.equal(result.ambiguous, true);
    });

    it("rejects invalid dates", () => {
      const result = normalizeDateOfBirth("32/13/1995");

      assert.equal(result.value, null);
      assert.equal(result.ambiguous, false);
    });

    it("does not calculate from age", () => {
      const result = normalizeDateOfBirth("25 anos");

      assert.equal(result.value, null);
      assert.equal(result.ambiguous, false);
    });
  });

  describe("normalizeCountry", () => {
    it("normalizes Brazil variants", () => {
      assert.equal(normalizeCountry("brasil"), "Brasil");
      assert.equal(normalizeCountry("Brazil"), "Brasil");
      assert.equal(normalizeCountry("BR"), "Brasil");
    });

    it("preserves accents for other countries", () => {
      assert.equal(normalizeCountry("Portugal"), "Portugal");
      assert.equal(normalizeCountry("Estados Unidos"), "Estados Unidos");
    });

    it("returns null for empty values", () => {
      assert.equal(normalizeCountry("   "), null);
    });
  });

  describe("normalizeExtractedModelData", () => {
    it("returns normalized fields and flags invalid data", () => {
      const result = normalizeExtractedModelData({
        fullName: "  Maria Clara  ",
        stageName: "",
        email: "maria@exemplo.com",
        phone: "+55 21 99999-4321",
        dateOfBirth: "15/03/1998",
        country: "brasil",
      });

      assert.equal(result.fullName, "Maria Clara");
      assert.equal(result.stageName, null);
      assert.equal(result.email, "maria@exemplo.com");
      assert.equal(result.emailValid, true);
      assert.equal(result.phone, "+5521999994321");
      assert.equal(result.phoneValid, true);
      assert.equal(result.dateOfBirth, "1998-03-15");
      assert.equal(result.dateAmbiguous, false);
      assert.equal(result.country, "Brasil");
    });

    it("flags invalid email and phone", () => {
      const result = normalizeExtractedModelData({
        fullName: "Joana",
        email: "not-an-email",
        phone: "123",
      });

      assert.equal(result.emailValid, false);
      assert.equal(result.phoneValid, false);
    });
  });

  describe("generateTemporaryPassword", () => {
    it("uses the last four digits and appends 1234567", () => {
      assert.equal(
        generateTemporaryPassword("21992120000"),
        "00001234567",
      );

      assert.equal(
        generateTemporaryPassword("5521999994321"),
        "43211234567",
      );
    });

    it("returns empty string when there are no digits", () => {
      assert.equal(generateTemporaryPassword(""), "");
    });
  });
});
