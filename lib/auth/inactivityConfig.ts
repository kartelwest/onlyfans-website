export const INACTIVITY_TIMEOUT_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS,
  8 * 60 * 1000,
);

export const WARNING_THRESHOLD_MS = parseTimeoutMs(
  process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS,
  7 * 60 * 1000,
);

export const MIN_TIMEOUT_MS = 5 * 60 * 1000;

export const LAST_ACTIVITY_COOKIE = "karay-last-activity";

export const BROADCAST_CHANNEL_NAME = "karay-inactivity";

export const EXPIRED_SESSION_MESSAGE =
  "Your session expired after 8 minutes of inactivity. Please sign in again.";

export const WARNING_MESSAGE =
  "Your session will expire in 1 minute due to inactivity.";

function parseTimeoutMs(
  envValue: string | undefined,
  defaultValue: number,
): number {
  if (!envValue) {
    return defaultValue;
  }

  const parsed = Number(envValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  if (parsed < MIN_TIMEOUT_MS) {
    return MIN_TIMEOUT_MS;
  }

  return Math.round(parsed);
}

export function isExpired(
  lastActivity: number | null,
  now: number = Date.now(),
): boolean {
  if (lastActivity === null) {
    return false;
  }

  return now - lastActivity >= INACTIVITY_TIMEOUT_MS;
}

export function shouldWarn(
  lastActivity: number | null,
  now: number = Date.now(),
): boolean {
  if (lastActivity === null) {
    return false;
  }

  const elapsed = now - lastActivity;

  return elapsed >= WARNING_THRESHOLD_MS && elapsed < INACTIVITY_TIMEOUT_MS;
}
