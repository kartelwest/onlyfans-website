/**
 * Login identifiers: e-mail addresses and usernames.
 *
 * Supabase authenticates by e-mail only — there is no username concept in the
 * auth layer and no username column anywhere in this schema. To let an admin
 * hand a model a plain username, we register that username as the local part
 * of an address on a domain reserved for exactly this purpose. The model then
 * types only her username at the login screen; the domain is internal and she
 * never sees it.
 *
 * MODEL_LOGIN_DOMAIN is deliberately a subdomain rather than the agency's main
 * domain: nothing can ever be delivered there, so a username can never collide
 * with a real staff mailbox.
 *
 * Shared by the login page (client) and the credential route (server), so this
 * module must stay free of server-only imports.
 */

export const MODEL_LOGIN_DOMAIN = "modelo.karaymodels.com";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

// Starts with a letter or digit, then letters, digits, dot, hyphen or
// underscore. Anything else — spaces, accents, "@" — is rejected.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

/**
 * Lowercases and trims a username. Returns null when it does not satisfy
 * USERNAME_PATTERN — callers surface their own message.
 */
export function normalizeUsername(value: string): string | null {
  const trimmed = value.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function usernameToLoginEmail(username: string): string {
  return `${username}@${MODEL_LOGIN_DOMAIN}`;
}

/**
 * The username behind a login address, or null when the address is a real
 * e-mail rather than one of our synthetic ones.
 */
export function loginEmailToUsername(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const suffix = `@${MODEL_LOGIN_DOMAIN}`;

  if (!normalized.endsWith(suffix)) {
    return null;
  }

  const username = normalized.slice(0, -suffix.length);

  return username || null;
}

/**
 * What to display for a stored login address: the bare username for synthetic
 * addresses, the address itself for real ones.
 */
export function describeLogin(email: string | null): string | null {
  if (!email) {
    return null;
  }

  return loginEmailToUsername(email) ?? email.trim().toLowerCase();
}

export type ResolvedLogin =
  | { ok: true; email: string; username: string | null }
  | { ok: false; reason: "invalid_email" | "invalid_username" };

/**
 * Turns whatever an admin typed into the address Supabase will authenticate
 * against. Input containing "@" is treated as an e-mail; anything else is
 * treated as a username.
 */
export function resolveLoginIdentifier(value: string): ResolvedLogin {
  const trimmed = value.trim();

  if (looksLikeEmail(trimmed)) {
    const email = trimmed.toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, reason: "invalid_email" };
    }

    return { ok: true, email, username: loginEmailToUsername(email) };
  }

  const username = normalizeUsername(trimmed);

  if (!username) {
    return { ok: false, reason: "invalid_username" };
  }

  return { ok: true, email: usernameToLoginEmail(username), username };
}
