import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DAILY_SECTIONS,
  buildDailyItemKey,
  flattenDaily,
} from "./definition";

import type { ManagementRole } from "@/types/model";

export type DailyAccess = {
  canRead: boolean;
  /** Whether this viewer may tick boxes and write notes right now. */
  canEdit: boolean;
};

type ModelAccessRow = {
  id: string;
  representative_id: string | null;
  profile_id: string | null;
};

/**
 * Resolves what this viewer may do with this model's daily checklist.
 *
 * Read: staff, the assigned representative, or the model herself.
 * Write: staff and the assigned representative — the people who actually run
 * the day. Unlike onboarding there is no completion lock: a daily routine that
 * froze at 100% would be finished forever, which is the opposite of the point.
 *
 * RLS enforces the same rules independently; this copy exists to produce a
 * readable message instead of a 500.
 */
export async function resolveDailyAccess({
  supabase,
  modelId,
  userId,
  role,
}: {
  supabase: SupabaseClient;
  modelId: string;
  userId: string;
  role: ManagementRole;
}): Promise<DailyAccess & { model: ModelAccessRow | null }> {
  const { data: model } = await supabase
    .from("models")
    .select("id, representative_id, profile_id")
    .eq("id", modelId)
    .maybeSingle<ModelAccessRow>();

  if (!model) {
    return { canRead: false, canEdit: false, model: null };
  }

  const isStaff = role === "owner" || role === "administrator";
  const isAssignedRep =
    role === "representative" && model.representative_id === userId;
  const isOwnModel = role === "model" && model.profile_id === userId;

  return {
    canRead: isStaff || isAssignedRep || isOwnModel,
    canEdit: isStaff || isAssignedRep,
    model,
  };
}

/**
 * Brings this model's rows in line with lib/daily/definition.ts: adds the steps
 * she is missing and drops the ones that are no longer part of the routine.
 * That second half matters — a step left behind after the list was rewritten
 * still counts towards her total, so her percentage could never reach 100.
 *
 * Runs with the admin client: the work is driven by the canonical list, never
 * by user input, and a representative holds no DELETE at all. Rows are matched
 * by (model_id, item_key), so this is safe to call on every read — recorded
 * progress against a step that still exists is never touched.
 */
export async function syncDailyItems({
  admin,
  modelId,
}: {
  admin: SupabaseClient;
  modelId: string;
}): Promise<void> {
  const { data: existing, error: existingError } = await admin
    .from("model_daily_checklist_items")
    .select("item_key")
    .eq("model_id", modelId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const seen = new Set((existing ?? []).map((row) => row.item_key as string));

  const canonical = flattenDaily();

  const canonicalKeys = new Set(
    canonical.map((item) => buildDailyItemKey(item.sectionKey, item.key)),
  );

  const missing = canonical.filter(
    (item) => !seen.has(buildDailyItemKey(item.sectionKey, item.key)),
  );

  const stale = Array.from(seen).filter((key) => !canonicalKeys.has(key));

  if (missing.length === 0 && stale.length === 0) {
    return;
  }

  if (stale.length > 0) {
    const { error: deleteError } = await admin
      .from("model_daily_checklist_items")
      .delete()
      .eq("model_id", modelId)
      .in("item_key", stale);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (missing.length > 0) {
    const { error: insertError } = await admin
      .from("model_daily_checklist_items")
      .insert(
        missing.map((item) => ({
          model_id: modelId,
          item_key: buildDailyItemKey(item.sectionKey, item.key),
          section_key: item.sectionKey,
          section_order: item.sectionOrder,
          item_order: item.itemOrder,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

/**
 * No `title` and no `description` here, on purpose.
 *
 * They used to be resolved server-side with getTranslations("daily"), which
 * made the checklist's words depend on the locale the ROUTE resolved while
 * every other word on the tab depended on the locale the BROWSER resolved.
 * When those two disagreed — and they can, since one reads a cookie on a fetch
 * and the other reads the rendered page — the panel came back in Portuguese
 * wrapped around an English list. The keys travel instead, and the component
 * looks them up in the reader's own catalogue.
 */
export type DailyItemView = {
  id: string;
  itemKey: string;
  sectionKey: string;
  /** The step's own key within its section — `items.<sectionKey>.<key>`. */
  key: string;
  completed: boolean;
  completedAt: string | null;
  /** Empty string when nobody has written one — the box starts closed. */
  notes: string;
};

export type DailySectionView = {
  key: string;
  order: number;
  items: DailyItemView[];
  completed: number;
  total: number;
  percentage: number;
};

export type DailySummary = {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  /** How many steps carry a note. Shown next to the counters. */
  withNotes: number;
};

type DailyItemRow = {
  id: string;
  item_key: string;
  section_key: string;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
};

const ITEM_COLUMNS = `
  id,
  item_key,
  section_key,
  completed,
  completed_at,
  notes
`;

function percentageOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/**
 * The checklist as the UI consumes it: the canonical definition joined to this
 * model's recorded progress, with the words coming from the catalogue.
 */
export async function loadDaily({
  supabase,
  modelId,
}: {
  supabase: SupabaseClient;
  modelId: string;
}): Promise<{
  sections: DailySectionView[];
  summary: DailySummary;
}> {
  const { data: rows, error: rowsError } = await supabase
    .from("model_daily_checklist_items")
    .select(ITEM_COLUMNS)
    .eq("model_id", modelId);

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const byKey = new Map(
    ((rows ?? []) as DailyItemRow[]).map((row) => [row.item_key, row]),
  );

  const sections: DailySectionView[] = [];

  let total = 0;
  let completed = 0;
  let withNotes = 0;

  DAILY_SECTIONS.forEach((section, sectionIndex) => {
    const items: DailyItemView[] = [];

    section.items.forEach((item) => {
      const itemKey = buildDailyItemKey(section.key, item.key);
      const row = byKey.get(itemKey);

      // Not seeded yet — a step added since this model's last read.
      if (!row) return;

      const notes = (row.notes ?? "").trim();

      items.push({
        id: row.id,
        itemKey,
        sectionKey: section.key,
        key: item.key,
        completed: row.completed === true,
        completedAt: row.completed_at,
        notes: row.notes ?? "",
      });

      if (notes !== "") {
        withNotes += 1;
      }
    });

    const sectionDone = items.filter((item) => item.completed).length;

    total += items.length;
    completed += sectionDone;

    sections.push({
      key: section.key,
      order: sectionIndex + 1,
      items,
      completed: sectionDone,
      total: items.length,
      percentage: percentageOf(sectionDone, items.length),
    });
  });

  return {
    sections,
    summary: {
      total,
      completed,
      remaining: total - completed,
      percentage: percentageOf(completed, total),
      withNotes,
    },
  };
}
