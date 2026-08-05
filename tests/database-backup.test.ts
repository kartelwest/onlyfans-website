import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BACKUP_MAGIC,
  decryptBackup,
  encryptBackup,
  resolveBackupKey,
} from "../lib/backup/crypto";
import {
  BACKUP_EXTENSION,
  BACKUP_PREFIX,
  RETENTION_DAYS,
  backupFileName,
  parseBackupTimestamp,
  selectExpired,
} from "../lib/backup/naming";

const KEY = resolveBackupKey("a".repeat(64));
const NOW = new Date("2026-08-05T04:30:00.000Z");

function daysAgo(n: number): string {
  return backupFileName(new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000));
}

describe("backup file naming", () => {
  it("round-trips a timestamp through the file name", () => {
    const name = backupFileName(NOW);
    const parsed = parseBackupTimestamp(name);

    assert.ok(name.startsWith(BACKUP_PREFIX));
    assert.ok(name.endsWith(BACKUP_EXTENSION));
    assert.strictEqual(parsed?.toISOString(), NOW.toISOString());
  });

  it("sorts chronologically as plain text", () => {
    const names = [daysAgo(0), daysAgo(10), daysAgo(2)];
    const sorted = [...names].sort();

    assert.deepStrictEqual(sorted, [daysAgo(10), daysAgo(2), daysAgo(0)]);
  });

  it("does not recognise names it did not write", () => {
    for (const name of [
      "backup.json",
      "karay-backup-nonsense.json.gz.enc",
      `${BACKUP_PREFIX}2026-08-05${BACKUP_EXTENSION}`,
      "karay-backup-2026-08-05T04-30-00-000Z.sql",
      "",
    ]) {
      assert.strictEqual(parseBackupTimestamp(name), null, name);
    }
  });
});

describe("retention sweep", () => {
  it("keeps everything inside the window", () => {
    const names = [daysAgo(0), daysAgo(1), daysAgo(RETENTION_DAYS - 1)];

    assert.deepStrictEqual(selectExpired(names, NOW), []);
  });

  it("removes what has aged out", () => {
    const old = daysAgo(RETENTION_DAYS + 1);

    assert.deepStrictEqual(selectExpired([daysAgo(0), old], NOW), [old]);
  });

  it("never touches a file it does not recognise", () => {
    // The bucket or Drive folder may hold somebody else's files. Deleting an
    // unrecognised name is the one mistake a retention sweep must not make.
    const foreign = [
      "important-contract.pdf",
      "backup.json",
      "karay-backup-README.txt",
      "2026-08-05-manual-export.sql",
    ];

    assert.deepStrictEqual(selectExpired(foreign, NOW), []);
    assert.deepStrictEqual(
      selectExpired([...foreign, daysAgo(90)], NOW),
      [daysAgo(90)],
    );
  });

  it("treats the boundary as still worth keeping", () => {
    const exactly = daysAgo(RETENTION_DAYS);
    const justOver = new Date(NOW.getTime() + 1);

    assert.deepStrictEqual(selectExpired([exactly], NOW), []);
    assert.deepStrictEqual(selectExpired([exactly], justOver), [exactly]);
  });
});

describe("backup encryption", () => {
  it("round-trips the compressed payload byte for byte", () => {
    const original = Buffer.from(
      JSON.stringify({ amount_brl: "500.00", nome: "Raíssa de Sousa Vieira" }),
      "utf8",
    );

    const restored = gunzipSync(
      decryptBackup(encryptBackup(gzipSync(original), KEY), KEY),
    );

    assert.deepStrictEqual(restored, original);
  });

  it("labels the file so it can be identified years later", () => {
    const payload = encryptBackup(Buffer.from("x"), KEY);

    assert.ok(payload.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC));
  });

  it("leaves no plaintext in the output", () => {
    const secret = "albetiza.teamo.123@gmail.com";
    const payload = encryptBackup(Buffer.from(secret.repeat(20)), KEY);

    assert.ok(!payload.toString("latin1").includes(secret));
  });

  it("refuses a file that is not a backup", () => {
    assert.throws(
      () => decryptBackup(Buffer.from("just some bytes here padded out"), KEY),
      /KARAYBK1/,
    );
  });

  it("refuses the wrong key", () => {
    const payload = encryptBackup(Buffer.from("secret"), KEY);

    assert.throws(() => decryptBackup(payload, resolveBackupKey("b".repeat(64))));
  });

  it("detects tampering rather than restoring corrupted data", () => {
    // GCM's whole point here: a truncated upload or an altered byte must fail
    // loudly, not decrypt into plausible-looking rubbish.
    const payload = encryptBackup(gzipSync(Buffer.from("earnings")), KEY);

    const flipped = Buffer.from(payload);
    flipped[flipped.length - 1] ^= 0x01;

    assert.throws(() => decryptBackup(flipped, KEY));
    assert.throws(() => decryptBackup(payload.subarray(0, payload.length - 4), KEY));
  });

  it("uses a fresh IV every run, so identical data never repeats a ciphertext", () => {
    const data = gzipSync(Buffer.from("the same database twice"));

    assert.notDeepStrictEqual(encryptBackup(data, KEY), encryptBackup(data, KEY));
  });

  it("accepts a hex key or a passphrase, and they differ", () => {
    assert.strictEqual(resolveBackupKey("f".repeat(64)).length, 32);
    assert.strictEqual(resolveBackupKey("a long passphrase").length, 32);
    assert.notDeepStrictEqual(
      resolveBackupKey("a".repeat(64)),
      resolveBackupKey("a".repeat(63) + "b"),
    );
  });
});

describe("the backup job is wired up", () => {
  const ROOT = join(import.meta.dirname, "..");

  it("runs nightly on Vercel", () => {
    const vercel = JSON.parse(
      readFileSync(join(ROOT, "vercel.json"), "utf8"),
    ) as { crons: { path: string; schedule: string }[] };

    const cron = vercel.crons.find(
      (c) => c.path === "/api/cron/database-backup",
    );

    assert.ok(cron, "the backup must be registered as a Vercel cron");
    assert.match(cron.schedule, /^\d+ \d+ \* \* \*$/, "must run daily");
  });

  it("is closed without CRON_SECRET, like the other crons", () => {
    const route = readFileSync(
      join(ROOT, "app/api/cron/database-backup/route.ts"),
      "utf8",
    );

    assert.match(route, /process\.env\.CRON_SECRET/);
    assert.match(route, /Bearer \$\{secret\}/);
    assert.match(route, /status: 503/, "no secret configured must close the route");
  });

  it("never parses the export payload as JSON", () => {
    // Postgres numeric carries its scale (500.00). Any JSON.parse on the way
    // to disk turns that into an IEEE double and rounds money in the backup.
    const runner = readFileSync(join(ROOT, "lib/backup/runBackup.ts"), "utf8");

    assert.ok(
      !/JSON\.parse/.test(runner),
      "the export is moved as opaque bytes, never parsed",
    );
    assert.match(runner, /Buffer\.from\(data, "utf8"\)/);
  });

  it("refuses to write an unencrypted backup", () => {
    const runner = readFileSync(join(ROOT, "lib/backup/runBackup.ts"), "utf8");
    const guard = runner.indexOf("BACKUP_ENCRYPTION_KEY");
    const upload = runner.indexOf("destinations.push");

    assert.ok(guard > -1 && guard < upload, "the key check precedes any upload");
  });

  it("exports every table, rather than a list that goes stale", () => {
    const migration = readFileSync(
      join(ROOT, "supabase/migrations/20260805080000_database_backup_export.sql"),
      "utf8",
    );

    assert.match(migration, /from pg_class c/, "tables are discovered, not listed");
    assert.match(migration, /returns text/, "must return text, not jsonb");
    assert.match(
      migration,
      /revoke execute on function public\.export_database_backup\(\) from authenticated/,
      "a full database read must not be reachable by a signed-in user",
    );
    assert.match(
      migration,
      /grant\s+execute on function public\.export_database_backup\(\) to service_role/,
    );
  });
});
