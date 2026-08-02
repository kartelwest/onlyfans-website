import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  describeLogin,
  loginEmailToUsername,
  MODEL_LOGIN_DOMAIN,
  normalizeUsername,
  resolveLoginIdentifier,
  usernameToLoginEmail,
} from "../lib/auth/loginIdentifier";

describe("login identifier", () => {
  it("treats anything containing @ as an e-mail", () => {
    const resolved = resolveLoginIdentifier("Maria@Exemplo.COM");

    assert.equal(resolved.ok, true);
    assert.equal(resolved.ok && resolved.email, "maria@exemplo.com");
    assert.equal(resolved.ok && resolved.username, null);
  });

  it("treats anything without @ as a username on the login domain", () => {
    const resolved = resolveLoginIdentifier("Maria.Silva");

    assert.equal(resolved.ok, true);
    assert.equal(resolved.ok && resolved.username, "maria.silva");
    assert.equal(
      resolved.ok && resolved.email,
      `maria.silva@${MODEL_LOGIN_DOMAIN}`,
    );
  });

  it("rejects malformed e-mails", () => {
    for (const value of ["maria@", "@exemplo.com", "maria@exemplo"]) {
      const resolved = resolveLoginIdentifier(value);

      assert.equal(resolved.ok, false, `should reject ${value}`);
      assert.equal(!resolved.ok && resolved.reason, "invalid_email");
    }
  });

  it("rejects usernames with spaces, accents or bad length", () => {
    for (const value of ["ma", "maria silva", "mariá", "-maria", "a".repeat(31)]) {
      const resolved = resolveLoginIdentifier(value);

      assert.equal(resolved.ok, false, `should reject ${value}`);
      assert.equal(!resolved.ok && resolved.reason, "invalid_username");
    }
  });

  it("accepts the punctuation an admin is likely to use", () => {
    for (const value of ["maria.silva", "maria_silva", "maria-silva", "maria2"]) {
      assert.equal(normalizeUsername(value), value, `should accept ${value}`);
    }
  });

  it("round-trips a username through its login address", () => {
    const email = usernameToLoginEmail("tainara");

    assert.equal(loginEmailToUsername(email), "tainara");
    assert.equal(describeLogin(email), "tainara");
  });

  it("shows a real address as itself, never as a username", () => {
    assert.equal(loginEmailToUsername("maria@gmail.com"), null);
    assert.equal(describeLogin("maria@gmail.com"), "maria@gmail.com");
    assert.equal(describeLogin(null), null);
  });

  it("does not mistake a lookalike domain for the login domain", () => {
    // Guards against a naive "contains" check matching, say,
    // tainara@notmodelo.karaymodels.com.evil.com
    assert.equal(
      loginEmailToUsername(`tainara@x${MODEL_LOGIN_DOMAIN}.evil.com`),
      null,
    );
  });
});
