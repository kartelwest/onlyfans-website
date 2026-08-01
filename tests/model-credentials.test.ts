import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateTemporaryPassword } from "../lib/admin/modelOnboardingHelpers";

// The owner create-user action strips non-digits with this exact expression
// before deriving the password, so the tests mirror it rather than importing
// the server action (which pulls in next/cache and the Supabase clients).
function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

describe("model first password", () => {
  it("is the last four WhatsApp digits followed by 1234567", () => {
    assert.equal(generateTemporaryPassword(toDigits("21964610220")), "02201234567");
  });

  it("ignores country codes, spaces and punctuation", () => {
    // Every one of these is a real formatting variant found in the models table.
    const cases: [string, string][] = [
      ["+5521977112133", "21331234567"],
      ["21 96575-2062", "20621234567"],
      ["+55 21 99999-9999", "99991234567"],
      ["85981704004", "40041234567"],
    ];

    for (const [whatsapp, expected] of cases) {
      assert.equal(
        generateTemporaryPassword(toDigits(whatsapp)),
        expected,
        `wrong password for ${whatsapp}`,
      );
    }
  });

  it("always clears the project's 8-character minimum", () => {
    const password = generateTemporaryPassword(toDigits("21964610220"));

    assert.equal(password.length, 11);
    assert.ok(password.length >= 8);
  });

  it("returns an empty string when there are no digits, so callers must fall back", () => {
    assert.equal(generateTemporaryPassword(""), "");
    assert.equal(generateTemporaryPassword(toDigits("sem telefone")), "");
  });

  it("uses the last four digits, not the first four", () => {
    const password = generateTemporaryPassword(toDigits("21964610220"));

    assert.ok(password.startsWith("0220"));
    assert.ok(!password.startsWith("2196"));
  });
});
