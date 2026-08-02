import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyAuthError,
  loginFailureMessage,
  type LoginFailureReason,
} from "../lib/auth/loginErrors";

test("a disabled account does not read like a credential problem", () => {
  const message = loginFailureMessage("account_disabled");

  assert.match(message, /desativada/);
  assert.match(message, /reativar/);
  // The regression that started all this: "senha" appearing here is what sent
  // an admin looking at auth records instead of at profiles.active.
  assert.doesNotMatch(message, /senha/i);
});

test("the three post-authentication causes are distinguishable", () => {
  const disabled = loginFailureMessage("account_disabled");
  const noProfile = loginFailureMessage("no_profile");
  const noModel = loginFailureMessage("no_model_record");

  assert.notEqual(disabled, noProfile);
  assert.notEqual(disabled, noModel);
  assert.notEqual(noProfile, noModel);

  // None of them may blame her credentials — the password was already accepted.
  for (const message of [disabled, noProfile, noModel]) {
    assert.doesNotMatch(message, /incorret/i);
  }
});

test("only genuine credential failures mention the password", () => {
  assert.match(loginFailureMessage("invalid_credentials"), /senha incorretos/);
  assert.equal(
    loginFailureMessage("invalid_identifier"),
    loginFailureMessage("invalid_credentials"),
  );
});

test("an unreachable auth server is reported as a connection problem", () => {
  const message = loginFailureMessage("network");

  assert.match(message, /conectar/);
  assert.doesNotMatch(message, /incorret/i);
});

test("every reason has a non-empty Portuguese message", () => {
  const reasons: LoginFailureReason[] = [
    "invalid_identifier",
    "invalid_credentials",
    "network",
    "no_profile",
    "account_disabled",
    "no_model_record",
    "unknown",
  ];

  for (const reason of reasons) {
    const message = loginFailureMessage(reason);
    assert.ok(message.length > 0, `${reason} has no message`);
    assert.match(message, /\.$/, `${reason} should end in a full stop`);
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
