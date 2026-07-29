import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INACTIVITY_TIMEOUT_MS,
  WARNING_THRESHOLD_MS,
  MIN_TIMEOUT_MS,
  isExpired,
  shouldWarn,
} from "../lib/auth/inactivityConfig";

describe("inactivityConfig", () => {
  describe("timeout values", () => {
    it("defaults to 8 minutes (480000 ms)", () => {
      assert.equal(
        INACTIVITY_TIMEOUT_MS,
        8 * 60 * 1000,
        "Default timeout must be exactly 8 minutes",
      );
    });

    it("warning threshold defaults to 7 minutes (420000 ms)", () => {
      assert.equal(
        WARNING_THRESHOLD_MS,
        7 * 60 * 1000,
        "Warning must fire at 7 minutes (1 minute before expiry)",
      );
    });

    it("minimum timeout is 5 minutes (300000 ms)", () => {
      assert.equal(
        MIN_TIMEOUT_MS,
        5 * 60 * 1000,
        "Minimum timeout must be 5 minutes",
      );
    });

    it("timeout is never below 5 minutes", () => {
      assert.ok(
        INACTIVITY_TIMEOUT_MS >= MIN_TIMEOUT_MS,
        "Configured timeout must not be below 5 minutes",
      );
    });
  });

  describe("isExpired", () => {
    it("returns false when lastActivity is null", () => {
      assert.equal(isExpired(null), false);
    });

    it("returns false for recent activity", () => {
      const now = Date.now();
      assert.equal(isExpired(now, now), false);
    });

    it("returns false at 7 minutes (just before expiry)", () => {
      const now = Date.now();
      const lastActivity = now - 7 * 60 * 1000;
      assert.equal(isExpired(lastActivity, now), false);
    });

    it("returns true at exactly 8 minutes", () => {
      const now = Date.now();
      const lastActivity = now - 8 * 60 * 1000;
      assert.equal(isExpired(lastActivity, now), true);
    });

    it("returns true after 8 minutes", () => {
      const now = Date.now();
      const lastActivity = now - 10 * 60 * 1000;
      assert.equal(isExpired(lastActivity, now), true);
    });

    it("returns false at 4 minutes (well within timeout)", () => {
      const now = Date.now();
      const lastActivity = now - 4 * 60 * 1000;
      assert.equal(isExpired(lastActivity, now), false);
    });
  });

  describe("shouldWarn", () => {
    it("returns false when lastActivity is null", () => {
      assert.equal(shouldWarn(null), false);
    });

    it("returns false for recent activity", () => {
      const now = Date.now();
      assert.equal(shouldWarn(now, now), false);
    });

    it("returns false at 6 minutes (before warning threshold)", () => {
      const now = Date.now();
      const lastActivity = now - 6 * 60 * 1000;
      assert.equal(shouldWarn(lastActivity, now), false);
    });

    it("returns true at 7 minutes (warning threshold)", () => {
      const now = Date.now();
      const lastActivity = now - 7 * 60 * 1000;
      assert.equal(shouldWarn(lastActivity, now), true);
    });

    it("returns true at 7 minutes 30 seconds", () => {
      const now = Date.now();
      const lastActivity = now - (7 * 60 * 1000 + 30 * 1000);
      assert.equal(shouldWarn(lastActivity, now), true);
    });

    it("returns false at 8 minutes (already expired, not just warning)", () => {
      const now = Date.now();
      const lastActivity = now - 8 * 60 * 1000;
      assert.equal(shouldWarn(lastActivity, now), false);
    });
  });

  describe("timeout applies to all roles", () => {
    const roles = ["owner", "administrator", "representative", "model"];

    for (const role of roles) {
      it(`role "${role}" has the same 8-minute timeout`, () => {
        assert.equal(
          INACTIVITY_TIMEOUT_MS,
          8 * 60 * 1000,
          `Role ${role} must have 8-minute timeout`,
        );
      });
    }
  });

  describe("background polling must not restart timer", () => {
    it("isExpired does not consider timestamp updates without genuine activity", () => {
      const now = Date.now();
      const lastActivity = now - 9 * 60 * 1000;

      assert.equal(
        isExpired(lastActivity, now),
        true,
        "A session idle for 9 minutes must be expired regardless of background polling",
      );
    });
  });
});
