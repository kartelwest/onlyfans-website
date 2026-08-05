/**
 * Backup file naming and the retention window.
 *
 * Kept apart from runBackup.ts, which is server-only, so the rule that decides
 * what gets DELETED can be tested directly. A retention sweep is the one part
 * of a backup system that destroys data, and it should not be the untested
 * part.
 */

export const BACKUP_PREFIX = "karay-backup-";
export const BACKUP_EXTENSION = ".json.gz.enc";

/**
 * Kept deliberately long: the failure this guards against is the one nobody
 * notices for weeks — a bad migration, a quiet deletion, a corrupted import.
 * Thirty nightly files of a database this size cost a few megabytes.
 */
export const RETENTION_DAYS = 30;

/** Sortable, and unambiguous in any locale — the retention sweep and a human
 *  scanning the folder both read it the same way. */
export function backupFileName(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");

  return `${BACKUP_PREFIX}${stamp}${BACKUP_EXTENSION}`;
}

/** The timestamp encoded in a backup file name, or null if the name is not
 *  one this job wrote. */
export function parseBackupTimestamp(name: string): Date | null {
  if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith(BACKUP_EXTENSION)) {
    return null;
  }

  const stamp = name.slice(BACKUP_PREFIX.length, -BACKUP_EXTENSION.length);

  // Reverse of backupFileName: 2026-08-05T18-13-42-123Z -> ISO 8601.
  const iso = stamp.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1T$2:$3:$4.$5Z",
  );

  if (iso === stamp) {
    return null;
  }

  const at = Date.parse(iso);

  return Number.isNaN(at) ? null : new Date(at);
}

/**
 * Files older than the retention window.
 *
 * Anything that does not parse as one of this job's names is left alone rather
 * than guessed at. The Drive folder or bucket may hold files somebody else put
 * there, and a sweep that deletes what it does not recognise is a data-loss
 * bug waiting to happen.
 */
export function selectExpired(
  names: string[],
  now: Date,
  retentionDays: number = RETENTION_DAYS,
): string[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  return names.filter((name) => {
    const at = parseBackupTimestamp(name);

    return at !== null && at.getTime() < cutoff;
  });
}
