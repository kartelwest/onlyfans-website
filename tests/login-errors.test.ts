import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  classifyAuthError,
  loginFailureKey,
  type LoginFailureReason,
} from "../lib/auth/loginErrors";

/**
 * The sentences live in the message catalogs now, so these assertions read them
 * from there. The point of the tests has not changed: a failure AFTER the
 * password was accepted must never be worded like a credential problem, and
 * that has to hold in every language the portal ships, not just the one it was
 * written in.
 */
const CATALOGS = {
  "pt-BR": JSON.parse(readFileSync("messages/pt-BR.json", "utf8")),
  "en-US": JSON.parse(readFileSync("messages/en-US.json", "utf8")),
} as const;

const REASONS: LoginFailureReason[] = [
  "invalid_identifier",
  "invalid_credentials",
  "network",
  "no_profile",
  "account_disabled",
  "no_model_record",
  "unknown",
];

function message(locale: keyof typeof CATALOGS, reason: LoginFailureReason): string {
  return CATALOGS[locale].errors.login[reason];
}

test("loginFailureKey names the catalog entry for a reason", () => {
  assert.equal(loginFailureKey("account_disabled"), "errors.login.account_disabled");
});

test("a disabled account does not read like a credential problem", () => {
  const pt = message("pt-BR", "account_disabled");

  assert.match(pt, /desativada/);
  assert.match(pt, /reativar/);
  // The regression that started all this: "senha" appearing here is what sent
  // an admin looking at auth records instead of at profiles.active.
  assert.doesNotMatch(pt, /senha/i);

  const en = message("en-US", "account_disabled");

  assert.match(en, /disabled/i);
  assert.doesNotMatch(en, /password/i);
});

test("the three post-authentication causes are distinguishable", () => {
  for (const locale of ["pt-BR", "en-US"] as const) {
    const disabled = message(locale, "account_disabled");
    const noProfile = message(locale, "no_profile");
    const noModel = message(locale, "no_model_record");

    assert.notEqual(disabled, noProfile, locale);
    assert.notEqual(disabled, noModel, locale);
    assert.notEqual(noProfile, noModel, locale);

    // None of them may blame her credentials — the password was already
    // accepted by the time any of these can happen.
    for (const text of [disabled, noProfile, noModel]) {
      assert.doesNotMatch(text, /incorret|incorrect/i, `${locale}: ${text}`);
    }
  }
});

test("only genuine credential failures mention the password", () => {
  assert.match(message("pt-BR", "invalid_credentials"), /senha incorretos/);
  assert.match(message("en-US", "invalid_credentials"), /password/i);

  // An unusable identifier is reported exactly like a wrong password, so the
  // form never reveals whether an account exists.
  for (const locale of ["pt-BR", "en-US"] as const) {
    assert.equal(
      message(locale, "invalid_identifier"),
      message(locale, "invalid_credentials"),
      locale,
    );
  }
});

test("an unreachable auth server is reported as a connection problem", () => {
  assert.match(message("pt-BR", "network"), /conectar/);
  assert.doesNotMatch(message("pt-BR", "network"), /incorret/i);

  assert.match(message("en-US", "network"), /connect/i);
  assert.doesNotMatch(message("en-US", "network"), /incorrect/i);
});

test("every reason has a non-empty message in every locale", () => {
  for (const locale of ["pt-BR", "en-US"] as const) {
    for (const reason of REASONS) {
      const text = message(locale, reason);

      assert.ok(
        typeof text === "string" && text.length > 0,
        `${locale}/${reason} has no message`,
      );
      assert.match(text, /\.$/, `${locale}/${reason} should end in a full stop`);
    }
  }
});

test("classifyAuthError separates 'auth said no' from 'auth never answered'", () => {
  assert.equal(
    classifyAuthError({ name: "AuthRetryableFetchError", status: 0 }),
    "network",
  );
  assert.equal(classifyAuthError({ name: "AuthApiError", status: 400 }), "invalid_credentials");
  assert.equal(classifyAuthError({ name: "AuthApiError", status: 401 }), "invalid_credentials");

  // A thrown error with no status at all never reached the server either.
  assert.equal(classifyAuthError({ name: "TypeError" }), "network");
  assert.equal(classifyAuthError(null), "invalid_credentials");
});
