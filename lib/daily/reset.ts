import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { agencyToday } from "@/lib/earnings/period";

import { syncDailyItems } from "./server";

/**
 * The nightly rollover of the daily marketing checklist.
 *
 * At 00:00 in São Paulo the day is over: every box ticked yesterday is
 * unticked and every note written against a step is cleared, so the team opens
 * a clean list. Two things survive the wipe, because losing them would make
 * the checklist unauditable:
 *
 *   - the model's history, which already holds every tick and every note as it
 *     happened (written by /api/models/daily);
 *   - one closing entry per model per day, written here, saying how much of
 *     the list was done before it was cleared.
 *
 * A model whose list was not touched at all also gets an automatic note in her
 * Notes tab — the absence of work, recorded where someone will see it.
 *
 * Idempotent per model: `models.daily_reset_on` holds the Brazilian date the
 * job last ran for that model, so a retry after a partial failure finishes the
 * job rather than wiping a second day of work.
 */

/** Written verbatim into the Notes tab. The agency's wording, not ours. */
const NOT_WORKED_NOTE = "NÃO FOI TRABALHADO";

const SYSTEM_ACTOR_NAME = "Sistema";

export type DailyResetResult = {
  /** The Brazilian date the run closed. */
  day: string;
  modelsProcessed: number;
  modelsNotWorked: number;
  itemsCleared: number;
  errors: string[];
};

type ModelRow = {
  id: string;
  display_name: string | null;
};

type ItemRow = {
  id: string;
  completed: boolean;
  notes: string | null;
};

/**
 * Runs the rollover for every active model that has not had one today.
 *
 * Takes the admin client: it writes across every model, and it has no user
 * behind it to satisfy RLS with.
 */
export async function resetDailyChecklists(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<DailyResetResult> {
  const day = agencyToday(now);

  const result: DailyResetResult = {
    day,
    modelsProcessed: 0,
    modelsNotWorked: 0,
    itemsCleared: 0,
    errors: [],
  };

  // Only active models. A candidate who has not been taken on, or a model who
  // has been switched off, is not "not worked on" — she is not being worked on
  // by design, and a nightly note saying otherwise would be noise.
  const { data: models, error: modelsError } = await admin
    .from("models")
    .select("id, display_name")
    .eq("active", true)
    .or(`daily_reset_on.is.null,daily_reset_on.neq.${day}`);

  if (modelsError) {
    throw new Error(modelsError.message);
  }

  for (const model of (models ?? []) as ModelRow[]) {
    try {
      await resetOneModel(admin, model, day, result);
      result.modelsProcessed += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      // One model's failure must not cost the other twenty-nine their reset.
      result.errors.push(`${model.id}: ${message}`);
      console.error(
        `Falha ao reiniciar o checklist diário da modelo ${model.id}:`,
        error,
      );
    }
  }

  return result;
}

async function resetOneModel(
  admin: SupabaseClient,
  model: ModelRow,
  day: string,
  result: DailyResetResult,
): Promise<void> {
  // A model who never had the tab opened has no rows at all. Seeding them here
  // means her first morning starts with the full list rather than an empty one.
  await syncDailyItems({ admin, modelId: model.id });

  const { data: items, error: itemsError } = await admin
    .from("model_daily_checklist_items")
    .select("id, completed, notes")
    .eq("model_id", model.id);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const rows = (items ?? []) as ItemRow[];

  const total = rows.length;
  const completed = rows.filter((row) => row.completed).length;

  const dirty = rows.filter(
    (row) => row.completed || (row.notes ?? "").trim() !== "",
  );

  if (dirty.length > 0) {
    const { error: clearError } = await admin
      .from("model_daily_checklist_items")
      .update({
        completed: false,
        // sync_daily_completed_at() nulls completed_at/by on its own, but the
        // job says so explicitly rather than relying on a trigger it does not
        // own to be the only thing that clears them.
        completed_at: null,
        completed_by: null,
        notes: null,
        updated_by: null,
      })
      .in(
        "id",
        dirty.map((row) => row.id),
      );

    if (clearError) {
      throw new Error(clearError.message);
    }

    result.itemsCleared += dirty.length;
  }

  const worked = completed > 0;

  if (!worked) {
    await writeNotWorkedNote(admin, model, day);
    result.modelsNotWorked += 1;
  }

  // The closing entry. Written after the wipe, so the history reads in the
  // order it happened: the day's ticks, then the day being closed.
  const { error: auditError } = await admin
    .from("model_audit_history")
    .insert({
      model_id: model.id,
      action: "daily_reset",
      field_name: "daily_checklist",
      previous_value: `${completed}/${total}`,
      new_value: `0/${total}`,
      actor_id: null,
      actor_name: SYSTEM_ACTOR_NAME,
      actor_role: null,
      source: "cron:/api/cron/daily-checklist-reset",
      summary: worked
        ? `Daily — dia ${formatDay(day)} encerrado: ${completed} de ${total} concluídos. Checklist reiniciado.`
        : `Daily — dia ${formatDay(day)} encerrado: ${NOT_WORKED_NOTE}. Checklist reiniciado.`,
    });

  if (auditError) {
    throw new Error(auditError.message);
  }

  const { error: stampError } = await admin
    .from("models")
    .update({ daily_reset_on: day })
    .eq("id", model.id);

  if (stampError) {
    throw new Error(stampError.message);
  }
}

/**
 * The automatic note. It lands in the Notes tab like any other note, is marked
 * `source = 'daily'` so it can be told apart from something a person wrote,
 * and is visible to the assigned representative — she is the one being told.
 */
async function writeNotWorkedNote(
  admin: SupabaseClient,
  model: ModelRow,
  day: string,
): Promise<void> {
  const body = `${NOT_WORKED_NOTE} — ${formatDay(day)}`;

  const { data: note, error: noteError } = await admin
    .from("model_notes")
    .insert({
      model_id: model.id,
      body,
      priority: "important",
      pinned: false,
      archived: false,
      source: "daily",
      rep_visible: true,
      created_context: "staff",
      author_id: null,
      author_name: SYSTEM_ACTOR_NAME,
      created_by: null,
      created_by_name: SYSTEM_ACTOR_NAME,
      updated_by: null,
      updated_by_name: SYSTEM_ACTOR_NAME,
    })
    .select("id")
    .single();

  if (noteError || !note) {
    throw new Error(noteError?.message ?? "Falha ao criar a nota automática.");
  }

  // Notes appear in the unified history through model_note_history, so a note
  // with no history row would be invisible in the very place the team looks.
  const { error: historyError } = await admin
    .from("model_note_history")
    .insert({
      note_id: note.id,
      model_id: model.id,
      action: "created",
      original_body: null,
      updated_body: body,
      editor_id: null,
      editor_name: SYSTEM_ACTOR_NAME,
    });

  if (historyError) {
    // Roll the note back rather than leave one behind with no trail — the same
    // bargain /api/models/notes makes when its history insert fails.
    await admin.from("model_notes").delete().eq("id", note.id);

    throw new Error(historyError.message);
  }
}

/** `2026-08-04` -> `04/08/2026`. The note is read by Brazilians. */
function formatDay(day: string): string {
  const [year, month, date] = day.split("-");

  return `${date}/${month}/${year}`;
}
