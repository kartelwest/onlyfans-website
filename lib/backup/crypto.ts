import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

/**
 * Encryption for the nightly database export.
 *
 * The same AES-256-GCM construction as lib/brand/tokenCrypto.ts, with three
 * differences that matter for a backup:
 *
 *   - It works on Buffers, not base64 strings. A backup is megabytes, and
 *     base64 would inflate it by a third for no benefit.
 *
 *   - The output carries a short magic header. A backup is read months after
 *     it was written, by someone who may not have this repository in front of
 *     them; the file should be able to say what it is and which format wrote
 *     it, rather than being an anonymous block of bytes.
 *
 *   - The key is passed in rather than read from the environment here, which
 *     keeps this module free of secrets and therefore testable. Resolving
 *     BACKUP_ENCRYPTION_KEY is the caller's job (lib/backup/runBackup.ts).
 *
 * Layout:  "KARAYBK1" | iv (16) | authTag (16) | ciphertext
 *
 * GCM authenticates as well as encrypts, so a truncated or altered upload
 * fails loudly at decryption instead of restoring quietly corrupted data —
 * the failure mode that actually matters for backups.
 */
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export const BACKUP_MAGIC = Buffer.from("KARAYBK1", "utf8");

/**
 * A 64-character hex string is used as-is; anything else is treated as a
 * passphrase and stretched. Same rule as SOCIAL_TOKEN_ENCRYPTION_KEY, so there
 * is one convention to remember rather than two.
 */
export function resolveBackupKey(raw: string): Buffer {
  if (!raw) {
    throw new Error("BACKUP_ENCRYPTION_KEY is not configured.");
  }

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return scryptSync(raw, "karay-backup-salt", KEY_LENGTH);
}

export function encryptBackup(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);

  return Buffer.concat([BACKUP_MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

export function decryptBackup(payload: Buffer, key: Buffer): Buffer {
  const header = BACKUP_MAGIC.length;

  if (
    payload.length < header + IV_LENGTH + AUTH_TAG_LENGTH ||
    !payload.subarray(0, header).equals(BACKUP_MAGIC)
  ) {
    throw new Error("Not a KARAY backup file (expected the KARAYBK1 header).");
  }

  const iv = payload.subarray(header, header + IV_LENGTH);
  const authTag = payload.subarray(
    header + IV_LENGTH,
    header + IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const encrypted = payload.subarray(header + IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
