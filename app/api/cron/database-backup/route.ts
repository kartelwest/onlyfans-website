import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { runDatabaseBackup } from "@/lib/backup/runBackup";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Vercel's cron limit for a hobby-tier function; the export itself takes a
// second or two at this size, and the headroom is for the two uploads.
export const maxDuration = 60;

/**
 * Nightly database export (see vercel.json). The Supabase project is on the
 * free plan — no automated backups, no point-in-time recovery — so this job is
 * the only thing standing between a bad night and starting over.
 *
 * Authorization copies /api/cron/ledger-snapshot exactly: Vercel sends
 * `Authorization: Bearer $CRON_SECRET`, and with no secret configured the
 * endpoint stays shut rather than falling open. That matters more here than
 * on the other crons — this one moves the entire database.
 *
 * Every run writes to system_audit_log, success or failure. A backup job whose
 * failures are invisible is worse than none: it produces confidence without
 * producing backups, and the gap is only discovered when somebody needs to
 * restore.
 */
export async function GET(request: NextRequest) {
  const tRoute = await getTranslations("errors.cron");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("CRON_SECRET não configurado — backup do banco bloqueado.");

    return NextResponse.json(
      { error: tRoute("notConfigured") },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: tRoute("unauthorized") }, { status: 401 });
  }

  const admin = createAdminClient();

  // The job runs unattended, so it books itself into the audit log under a
  // system actor rather than a person. actor_id is null: no profile did this.
  const record = async (
    action: string,
    summary: string,
    value: Record<string, unknown>,
  ) => {
    const { error } = await admin.from("system_audit_log").insert({
      action,
      target_type: "database",
      target_name: "KARAY Models",
      new_value: value,
      actor_id: null,
      actor_name: "Backup automático",
      actor_role: "owner",
      source: "cron:/api/cron/database-backup",
      summary,
    });

    if (error) {
      console.error("Falha ao registrar o backup no histórico:", error);
    }
  };

  try {
    const result = await runDatabaseBackup(admin);

    const reached = result.destinations.filter((d) => d.ok);
    const failed = result.destinations.filter((d) => !d.ok);

    await record(
      result.ok ? "database_backup_completed" : "database_backup_failed",
      result.ok
        ? `Backup ${result.fileName} gravado em ${reached
            .map((d) => d.destination)
            .join(" e ")} (${Math.round(result.storedBytes / 1024)} KB).` +
            (failed.length
              ? ` Falhou em: ${failed.map((d) => d.destination).join(", ")}.`
              : "")
        : `O backup ${result.fileName} não pôde ser gravado em nenhum destino.`,
      {
        file_name: result.fileName,
        raw_bytes: result.rawBytes,
        stored_bytes: result.storedBytes,
        encrypted: result.encrypted,
        destinations: result.destinations,
      },
    );

    // A partial run is still a warning worth surfacing to Vercel's cron log,
    // so it answers 207 rather than pretending everything is well.
    return NextResponse.json(
      { success: result.ok, ...result },
      { status: result.ok ? (failed.length ? 207 : 200) : 500 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("Backup do banco de dados falhou:", error);

    await record("database_backup_failed", `Backup falhou: ${message}`, {
      error: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
