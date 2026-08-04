/**
 * Why a sign-in attempt failed, and what to tell her about it.
 *
 * These used to all collapse into "Esta conta está desativada.", which cost an
 * admin a long hunt through a Supabase auth record that was perfectly healthy:
 * the password had been accepted, the block came from the app afterwards. The
 * distinction that matters is BEFORE vs AFTER authentication — anything after
 * it must never read like a credential problem.
 *
 * Kept out of the component so each branch can be asserted in tests
 * (tests/login-errors.test.ts) rather than only in a browser.
 */

export type LoginFailureReason =
  /** The identifier is not a usable e-mail or username — never reached auth. */
  | "invalid_identifier"
  /** Auth rejected the pair. Genuinely wrong e-mail/username or password. */
  | "invalid_credentials"
  /** Auth was unreachable. Her credentials were never actually checked. */
  | "network"
  /** Authenticated, but no profiles row — provisioning never finished. */
  | "no_profile"
  /** Authenticated, profile exists, profiles.active is false. */
  | "account_disabled"
  /** Authenticated as a model, but no models row is linked to her profile. */
  | "no_model_record"
  | "unknown";

/**
 * The catalog key each reason is written up as.
 *
 * The sentences themselves moved to `errors.login.*` in messages/*.json when
 * the portal became bilingual — a reason is a fact about what happened, and a
 * fact does not have a language. The distinctions the messages have to preserve
 * are asserted against the catalogs in tests/login-errors.test.ts, so the
 * regression that started all this still cannot come back in either language.
 */
export function loginFailureKey(reason: LoginFailureReason): string {
  return `errors.login.${reason}`;
}

/**
 * Separates "auth said no" from "auth never answered".
 *
 * supabase-js raises AuthRetryableFetchError (status 0) when the request never
 * completed — offline, DNS, a blocked host. Reporting that as a wrong password
 * sends her to reset a password that was never the problem.
 */
export function classifyAuthError(error: {
  name?: string;
  status?: number;
} | null): Extract<LoginFailureReason, "invalid_credentials" | "network"> {
  if (!error) {
    return "invalid_credentials";
  }

  if (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    error.status === undefined
  ) {
    return "network";
  }

  return "invalid_credentials";
}
