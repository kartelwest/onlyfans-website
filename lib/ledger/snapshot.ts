import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { agencyToday } from "@/lib/earnings/period";
import { getFxRatesForDates } from "@/lib/fx/rates";
import { BRL, USD } from "@/lib/money/currency";

// Once a ledger entry's `deduct_on` is reached, the BRL->USD rate for that day
// is written onto the row and frozen: the USD figure a model saw for a past
// month must never move again.
//
// This runs from two places on purpose — a daily Vercel cron and lazily on
// every read of the earnings card — so a cron that failed or never fired can
// never leave a due row unsnapshotted.

type PendingRow = {
  id: string;
  model_id: string;
  amount_brl: number | string;
  deduct_on: string;
};

export type SnapshotResult = {
  snapshotted: number;
  skipped: number;
};

/**
 * Snapshots every entry whose deduction date has arrived.
 *
 * `supabase` must be a service-role client: this is a system operation with no
 * acting user, and it has to run for models the caller may not be able to read.
 */
export async function snapshotDueLedgerEntries(
  supabase: SupabaseClient,
  options: { modelId?: string; now?: Date } = {},
): Promise<SnapshotResult> {
  const now = options.now ?? new Date();
  const today = agencyToday(now);

  let query = supabase
    .from("model_ledger_entries")
    .select("id, model_id, amount_brl, deduct_on")
    .is("deleted_at", null)
    .is("deducted_at", null)
    .not("deduct_on", "is", null)
    .lte("deduct_on", today);

  if (options.modelId) {
    query = query.eq("model_id", options.modelId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Falha ao carregar lançamentos a descontar:", error);
    return { snapshotted: 0, skipped: 0 };
  }

  const pending = (data ?? []) as PendingRow[];

  if (pending.length === 0) {
    return { snapshotted: 0, skipped: 0 };
  }

  // Deductions are suspended while a model has the feature switched off:
  // unchecking the box must not keep freezing new rows behind the agency's
  // back. Re-checking resumes them from wherever they left off.
  const modelIds = Array.from(new Set(pending.map((row) => row.model_id)));

  const { data: eligibleModels, error: modelsError } = await supabase
    .from("models")
    .select("id")
    .in("id", modelIds)
    .eq("expenses_enabled", true);

  if (modelsError) {
    console.error(
      "Falha ao verificar a elegibilidade das modelos para lançamentos:",
      modelsError,
    );

    return { snapshotted: 0, skipped: pending.length };
  }

  const eligible = new Set((eligibleModels ?? []).map((row) => row.id));
  const due = pending.filter((row) => eligible.has(row.model_id));

  if (due.length === 0) {
    return { snapshotted: 0, skipped: pending.length };
  }

  const rates = await getFxRatesForDates(
    supabase,
    USD,
    BRL,
    due.map((row) => row.deduct_on),
    now,
  );

  let snapshotted = 0;
  let skipped = pending.length - due.length;

  for (const row of due) {
    const rate = rates.get(row.deduct_on);

    // No rate for that day and nothing cached to fall back on: leave the row
    // pending rather than freezing a made-up number. The next run retries.
    if (!rate || rate.rate <= 0) {
      skipped += 1;
      continue;
    }

    const amountUsd = Number(row.amount_brl) / rate.rate;

    const { error: updateError } = await supabase
      .from("model_ledger_entries")
      .update({
        deduction_fx_rate: rate.rate,
        deduction_amount_usd: Number(amountUsd.toFixed(2)),
        deducted_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .is("deducted_at", null);

    if (updateError) {
      console.error(
        `Falha ao registrar o desconto do lançamento ${row.id}:`,
        updateError,
      );

      skipped += 1;
      continue;
    }

    snapshotted += 1;
  }

  return { snapshotted, skipped };
}
