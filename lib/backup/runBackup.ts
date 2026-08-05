import "server-only";

import { gzipSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptBackup, resolveBackupKey } from "@/lib/backup/crypto";
import {
  BACKUP_PREFIX,
  backupFileName,
  selectExpired,
} from "@/lib/backup/naming";
import {
  deleteDriveFile,
  isDriveUploadConfigured,
  listDriveFolderFiles,
  uploadFileToDriveFolder,
} from "@/lib/googleDrive";

/**
 * The nightly database export.
 *
 * It goes to two places, because they fail for different reasons. The Supabase
 * Storage bucket is the fast copy: it is one API call away when somebody
 * deletes the wrong row and wants yesterday's data back. Google Drive is the
 * copy that matters when Supabase itself is the problem — a lapsed card, a
 * project deleted by accident, an account nobody can sign into. A backup that
 * lives only inside the system it is backing up protects against bad queries
 * and nothing else.
 *
 * Neither destination is allowed to fail the job on its own. A run that
 * reaches Drive but not Storage still produced an off-site copy and is worth
 * far more than an exception, so failures are collected and reported rather
 * than thrown.
 */

export type BackupDestinationResult = {
  destination: "supabase-storage" | "google-drive";
  ok: boolean;
  detail: string;
  pruned?: number;
};

export type BackupResult = {
  fileName: string;
  rawBytes: number;
  storedBytes: number;
  encrypted: boolean;
  destinations: BackupDestinationResult[];
  ok: boolean;
};

export async function runDatabaseBackup(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<BackupResult> {
  // Returned as text by design — see the migration. Parsing it here would turn
  // every Postgres `numeric` into an IEEE double and round money on the way to
  // disk, so the payload is treated as opaque bytes from this point on.
  const { data, error } = await admin.rpc("export_database_backup");

  if (error) {
    throw new Error(`A exportação do banco de dados falhou: ${error.message}`);
  }

  if (typeof data !== "string" || data.length === 0) {
    throw new Error("A exportação do banco de dados voltou vazia.");
  }

  const raw = Buffer.from(data, "utf8");
  const compressed = gzipSync(raw);

  const keyMaterial = process.env.BACKUP_ENCRYPTION_KEY;

  if (!keyMaterial) {
    // Refusing is the right call: this payload is every model's legal name,
    // birth date, phone number and earnings. An unencrypted copy sitting in
    // cloud storage is a worse outcome than a missed night, and a missed
    // night is loud (the job reports failure) where a plaintext backup is
    // silent.
    throw new Error(
      "BACKUP_ENCRYPTION_KEY não está configurada — o backup foi interrompido " +
        "em vez de gravar dados pessoais sem criptografia.",
    );
  }

  const payload = encryptBackup(compressed, resolveBackupKey(keyMaterial));
  const fileName = backupFileName(now);

  const destinations: BackupDestinationResult[] = [];

  destinations.push(await toSupabaseStorage(admin, fileName, payload, now));
  destinations.push(await toGoogleDrive(fileName, payload, now));

  return {
    fileName,
    rawBytes: raw.byteLength,
    storedBytes: payload.byteLength,
    encrypted: true,
    destinations,
    ok: destinations.some((d) => d.ok),
  };
}

async function toSupabaseStorage(
  admin: SupabaseClient,
  fileName: string,
  payload: Buffer,
  now: Date,
): Promise<BackupDestinationResult> {
  try {
    const { error } = await admin.storage
      .from("database-backups")
      .upload(fileName, payload, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (error) {
      return {
        destination: "supabase-storage",
        ok: false,
        detail: error.message,
      };
    }

    let pruned = 0;

    const { data: existing } = await admin.storage
      .from("database-backups")
      .list("", { limit: 1000 });

    if (existing?.length) {
      const expired = selectExpired(
        existing.map((f) => f.name),
        now,
      );

      if (expired.length) {
        const { error: removeError } = await admin.storage
          .from("database-backups")
          .remove(expired);

        if (!removeError) {
          pruned = expired.length;
        }
      }
    }

    return {
      destination: "supabase-storage",
      ok: true,
      detail: fileName,
      pruned,
    };
  } catch (error) {
    return {
      destination: "supabase-storage",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function toGoogleDrive(
  fileName: string,
  payload: Buffer,
  now: Date,
): Promise<BackupDestinationResult> {
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;

  if (!folderId) {
    return {
      destination: "google-drive",
      ok: false,
      detail: "GOOGLE_DRIVE_BACKUP_FOLDER_ID não configurado.",
    };
  }

  if (!isDriveUploadConfigured()) {
    return {
      destination: "google-drive",
      ok: false,
      detail:
        "Conta de serviço do Google não configurada (GOOGLE_SERVICE_ACCOUNT_*).",
    };
  }

  try {
    await uploadFileToDriveFolder(folderId, {
      name: fileName,
      mimeType: "application/octet-stream",
      buffer: payload,
    });

    let pruned = 0;

    const files = await listDriveFolderFiles(folderId, BACKUP_PREFIX);
    const expired = new Set(
      selectExpired(
        files.map((f) => f.name),
        now,
      ),
    );

    for (const file of files) {
      if (!expired.has(file.name)) continue;

      try {
        await deleteDriveFile(file.id);
        pruned += 1;
      } catch (error) {
        console.error(
          `Não foi possível remover o backup antigo ${file.name} do Drive:`,
          error,
        );
      }
    }

    return {
      destination: "google-drive",
      ok: true,
      detail: fileName,
      pruned,
    };
  } catch (error) {
    return {
      destination: "google-drive",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
