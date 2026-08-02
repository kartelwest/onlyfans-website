import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LINKED_FIELDS,
  ONBOARDING_PLATFORM,
  ONBOARDING_SECTIONS,
  READ_ONLY_LINKED_FIELDS,
  buildItemKey,
  flattenOnboarding,
  isReadOnlyLinkedFieldKey,
  linkedFieldLocation,
  type AnyLinkedFieldKey,
  type LinkedFieldKey,
  type OnboardingResponsibility,
} from "./definition";

import type { ManagementRole } from "@/types/model";

/**
 * Which table each linked column lives in. Mirrors the two allowlists inside
 * public.set_onboarding_linked_field — that function is the authority, this
 * split only decides where to READ the current value from.
 */
const PAYMENT_LINKED_COLUMNS = new Set<LinkedFieldKey>([
  "pix_key",
  "pix_type",
  "bank_name",
  "bank_agency",
  "bank_account",
  "account_holder_name",
  "account_holder_cpf",
  "payment_frequency",
]);

/**
 * Everything the checklist can display, writable or not. The read-only keys
 * are read from `models` exactly like the rest — they simply have no path to
 * a write (no entry in the RPC allowlist, refused by the route handler).
 */
const LINKED_KEYS = [
  ...(Object.keys(LINKED_FIELDS) as LinkedFieldKey[]),
  ...(Object.keys(READ_ONLY_LINKED_FIELDS) as AnyLinkedFieldKey[]),
] as AnyLinkedFieldKey[];

const MODEL_LINKED_COLUMNS = LINKED_KEYS.filter(
  (key) => !PAYMENT_LINKED_COLUMNS.has(key as LinkedFieldKey),
);

export function linkedFieldTable(
  key: LinkedFieldKey,
): "models" | "model_payments" {
  return PAYMENT_LINKED_COLUMNS.has(key) ? "model_payments" : "models";
}

export type OnboardingAccess = {
  canRead: boolean;
  /** Whether this viewer may tick boxes and fill fields right now. */
  canEdit: boolean;
  /** True once onboarding is complete — only the owner may still edit. */
  locked: boolean;
};

type ModelAccessRow = {
  id: string;
  representative_id: string | null;
  profile_id: string | null;
  onboarding_complete: boolean;
};

/**
 * Resolves what this viewer may do with this model's onboarding.
 *
 * Read: staff, the assigned representative, or the model herself.
 * Write: staff and the assigned representative — that is what lets a rep
 * onboard her own models — narrowing to the owner alone once onboarding is
 * complete. The same rules are enforced again by RLS and by the lock trigger;
 * this is the copy that produces a friendly message instead of a 500.
 */
export async function resolveOnboardingAccess({
  supabase,
  modelId,
  userId,
  role,
}: {
  supabase: SupabaseClient;
  modelId: string;
  userId: string;
  role: ManagementRole;
}): Promise<OnboardingAccess & { model: ModelAccessRow | null }> {
  const { data: model } = await supabase
    .from("models")
    .select("id, representative_id, profile_id, onboarding_complete")
    .eq("id", modelId)
    .maybeSingle<ModelAccessRow>();

  if (!model) {
    return { canRead: false, canEdit: false, locked: false, model: null };
  }

  const locked = model.onboarding_complete === true;

  const isStaff = role === "owner" || role === "administrator";
  const isAssignedRep =
    role === "representative" && model.representative_id === userId;
  const isOwnModel = role === "model" && model.profile_id === userId;

  const canRead = isStaff || isAssignedRep || isOwnModel;

  // The owner keeps editing after completion; everyone else is frozen out.
  const canEdit =
    role === "owner" || (!locked && (isStaff || isAssignedRep));

  return { canRead, canEdit, locked, model };
}

/**
 * Brings this model's rows in line with lib/onboarding/definition.ts: adds the
 * steps she is missing and drops the ones that are no longer part of the
 * process. That second half matters — a step left behind after the checklist
 * was rewritten still counts towards her total, so her percentage could never
 * reach 100 again.
 *
 * Runs with the admin client: the work is driven by the canonical list, never
 * by user input, and a representative holds no INSERT on a model she is not
 * assigned to (nor DELETE on any). Rows are matched by
 * (model_id, platform, item_key), so this is safe to call on every read —
 * recorded progress against a step that still exists is never touched.
 */
export async function syncOnboardingItems({
  admin,
  modelId,
  locked,
}: {
  admin: SupabaseClient;
  modelId: string;
  locked: boolean;
}): Promise<void> {
  const { data: existing, error: existingError } = await admin
    .from("model_onboarding_items")
    .select("item_key")
    .eq("model_id", modelId)
    .eq("platform", ONBOARDING_PLATFORM);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const seen = new Set((existing ?? []).map((row) => row.item_key as string));

  const canonical = flattenOnboarding();

  const canonicalKeys = new Set(
    canonical.map((item) => buildItemKey(item.sectionKey, item.key)),
  );

  const missing = canonical.filter(
    (item) => !seen.has(buildItemKey(item.sectionKey, item.key)),
  );

  const stale = Array.from(seen).filter((key) => !canonicalKeys.has(key));

  if (missing.length === 0 && stale.length === 0) {
    return;
  }

  // A completed onboarding is frozen for everyone but the owner, and the lock
  // trigger rejects both halves of this. She keeps the list she finished until
  // an owner reopens it.
  if (locked) {
    return;
  }

  if (stale.length > 0) {
    const { error: deleteError } = await admin
      .from("model_onboarding_items")
      .delete()
      .eq("model_id", modelId)
      .eq("platform", ONBOARDING_PLATFORM)
      .in("item_key", stale);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (missing.length > 0) {
    const { error: insertError } = await admin
      .from("model_onboarding_items")
      .insert(
        missing.map((item) => ({
          model_id: modelId,
          platform: ONBOARDING_PLATFORM,
          item_key: buildItemKey(item.sectionKey, item.key),
          section_key: item.sectionKey,
          section_title: item.sectionTitle,
          section_order: item.sectionOrder,
          item_title: item.title,
          item_description: item.description ?? null,
          item_order: item.itemOrder,
          responsibility: item.responsibility,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export type OnboardingFieldValue = {
  key: string;
  label: string;
  type: string;
  placeholder: string | null;
  options: string[] | null;
  required: boolean;
  /** Null for a field stored on the step itself. */
  linked: AnyLinkedFieldKey | null;
  /** Where else in the app the same value appears — UI hint only. */
  linkedLocation: string | null;
  /** Shown for reference, editable only where it actually lives. */
  readOnly: boolean;
  value: string;
};

export type OnboardingItemView = {
  id: string;
  itemKey: string;
  sectionKey: string;
  sectionTitle: string;
  sectionOrder: number;
  title: string;
  description: string | null;
  itemOrder: number;
  responsibility: OnboardingResponsibility;
  completed: boolean;
  completedAt: string | null;
  fields: OnboardingFieldValue[];
  /** Required fill-in boxes still empty — the step cannot be ticked yet. */
  missingRequired: string[];
};

export type OnboardingSectionView = {
  key: string;
  title: string;
  order: number;
  items: OnboardingItemView[];
  completed: number;
  total: number;
  percentage: number;
};

export type OnboardingSummary = {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  /** Split by who owes the work, for the two side-by-side bars. */
  modelPercentage: number;
  agencyPercentage: number;
};

type ItemRow = {
  id: string;
  item_key: string;
  section_key: string;
  section_title: string;
  section_order: number;
  item_title: string;
  item_description: string | null;
  item_order: number;
  responsibility: OnboardingResponsibility;
  completed: boolean;
  completed_at: string | null;
  field_values: Record<string, unknown> | null;
};

const ITEM_COLUMNS = `
  id,
  item_key,
  section_key,
  section_title,
  section_order,
  item_title,
  item_description,
  item_order,
  responsibility,
  completed,
  completed_at,
  field_values
`;

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/**
 * Reads the current value of every linked field in one pass.
 *
 * A model role cannot select model_payments at all, so that half comes back
 * null for her and the boxes simply render empty — her read-only view never
 * needed them.
 */
async function loadLinkedValues({
  supabase,
  modelId,
}: {
  supabase: SupabaseClient;
  modelId: string;
}): Promise<Record<string, string>> {
  const [{ data: modelRow }, { data: paymentsRow }] = await Promise.all([
    supabase
      .from("models")
      .select(MODEL_LINKED_COLUMNS.join(", "))
      .eq("id", modelId)
      .maybeSingle(),
    supabase
      .from("model_payments")
      .select(Array.from(PAYMENT_LINKED_COLUMNS).join(", "))
      .eq("model_id", modelId)
      .maybeSingle(),
  ]);

  const values: Record<string, string> = {};

  for (const key of LINKED_KEYS) {
    const source = (
      PAYMENT_LINKED_COLUMNS.has(key as LinkedFieldKey) ? paymentsRow : modelRow
    ) as Record<string, unknown> | null;

    values[key] = asText(source?.[key]);
  }

  return values;
}

function percentageOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/**
 * Loads the checklist as the UI consumes it: the canonical definition joined
 * to this model's recorded progress, with every fill-in box carrying its
 * current value — whether that value lives on the step or in the table it is
 * linked to.
 */
export async function loadOnboarding({
  supabase,
  modelId,
}: {
  supabase: SupabaseClient;
  modelId: string;
}): Promise<{
  sections: OnboardingSectionView[];
  summary: OnboardingSummary;
}> {
  const [{ data: rows, error: rowsError }, linkedValues] = await Promise.all([
    supabase
      .from("model_onboarding_items")
      .select(ITEM_COLUMNS)
      .eq("model_id", modelId)
      .eq("platform", ONBOARDING_PLATFORM)
      .order("section_order", { ascending: true })
      .order("item_order", { ascending: true }),
    loadLinkedValues({ supabase, modelId }),
  ]);

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const byKey = new Map(
    ((rows ?? []) as ItemRow[]).map((row) => [row.item_key, row]),
  );

  const sections: OnboardingSectionView[] = [];

  let total = 0;
  let completed = 0;
  let modelTotal = 0;
  let modelDone = 0;
  let agencyTotal = 0;
  let agencyDone = 0;

  ONBOARDING_SECTIONS.forEach((section, sectionIndex) => {
    const items: OnboardingItemView[] = [];

    section.items.forEach((item, itemIndex) => {
      const itemKey = buildItemKey(section.key, item.key);
      const row = byKey.get(itemKey);

      // Not seeded yet (a locked model, or a step added since her last read).
      if (!row) return;

      const stored = (row.field_values ?? {}) as Record<string, unknown>;

      const fields: OnboardingFieldValue[] = (item.fields ?? []).map(
        (field) => {
          const linked = field.linked ?? null;

          return {
            key: field.key,
            label: field.label,
            type: field.type,
            placeholder: field.placeholder ?? null,
            options: field.options ?? null,
            required: field.required === true,
            linked,
            linkedLocation: linked ? linkedFieldLocation(linked) : null,
            readOnly: linked ? isReadOnlyLinkedFieldKey(linked) : false,
            value: linked
              ? (linkedValues[linked] ?? "")
              : asText(stored[field.key]),
          };
        },
      );

      const missingRequired = fields
        .filter((field) => field.required && field.value.trim() === "")
        .map((field) => field.label);

      items.push({
        id: row.id,
        itemKey,
        sectionKey: section.key,
        sectionTitle: section.title,
        sectionOrder: sectionIndex + 1,
        title: item.title,
        description: item.description ?? null,
        itemOrder: itemIndex + 1,
        responsibility: item.responsibility,
        completed: row.completed,
        completedAt: row.completed_at,
        fields,
        missingRequired,
      });

      total += 1;
      if (row.completed) completed += 1;

      if (item.responsibility === "model" || item.responsibility === "both") {
        modelTotal += 1;
        if (row.completed) modelDone += 1;
      }

      if (item.responsibility === "agency" || item.responsibility === "both") {
        agencyTotal += 1;
        if (row.completed) agencyDone += 1;
      }
    });

    if (items.length === 0) return;

    const sectionDone = items.filter((item) => item.completed).length;

    sections.push({
      key: section.key,
      title: section.title,
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
      remaining: Math.max(total - completed, 0),
      percentage: percentageOf(completed, total),
      modelPercentage: percentageOf(modelDone, modelTotal),
      agencyPercentage: percentageOf(agencyDone, agencyTotal),
    },
  };
}
