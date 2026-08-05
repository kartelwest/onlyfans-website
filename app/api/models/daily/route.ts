import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAuditEntry } from "@/lib/audit/auditLogger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DAILY_NOTE_MAX_LENGTH,
  findDailyItem,
} from "@/lib/daily/definition";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import {
  loadDaily,
  resolveDailyAccess,
  syncDailyItems,
} from "@/lib/daily/server";

import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * The one audit action this route writes. Both a tick and a note land in the
 * model's history under it, so "Daily" can be filtered as a single stream.
 */
const DAILY_ACTION = "daily_update";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  role: ManagementRole;
  active: boolean;
  status: string | null;
};

type PatchBody = {
  modelId?: string;
  itemKey?: string;
  completed?: boolean;
  notes?: string;
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthenticatedProfile() {
  const t = await getTranslations("errors.api");
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: fail(t("notAuthenticated"), 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, status")
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (profileError || !profile || !profile.active) {
    return { error: fail(t("invalidOrInactiveProfile"), 403) };
  }

  if (profile.role === "representative" && profile.status !== "ativa") {
    return { error: fail(t("inactiveRepresentative"), 403) };
  }

  return { supabase, user, profile };
}

export async function GET(request: Request) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.dailyApi");

  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const modelId = new URL(request.url).searchParams.get("modelId");

    if (!modelId) {
      return fail(t("modelIdMissing"), 400);
    }

    const access = await resolveDailyAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.model || !access.canRead) {
      return fail(tRoute("noViewPermission"), 403);
    }

    await syncDailyItems({ admin: createAdminClient(), modelId });

    const { sections, summary } = await loadDaily({
      supabase: auth.supabase,
      modelId,
    });

    return NextResponse.json({
      sections,
      summary,
      canEdit: access.canEdit,
      viewerRole: auth.profile.role,
    });
  } catch (error) {
    console.error("Erro ao carregar o checklist diário:", error);

    return fail(tRoute("loadFailed"), 500);
  }
}

export async function PATCH(request: Request) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.dailyApi");
  // Pinned to the product's first language, not the writer's. What gets stored
  // is the raw record; the History tab renders daily rows in the reader's
  // language from the item key and the tokens below, so a summary written in
  // whoever-happened-to-be-logged-in's language would only make the stored
  // trail inconsistent with itself.
  const tDaily = await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "daily",
  });

  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as PatchBody;

    const { modelId, itemKey } = body;

    if (!modelId || !itemKey) {
      return fail(t("invalidData"), 400);
    }

    const definition = findDailyItem(itemKey);

    if (!definition) {
      return fail(tRoute("unknownStep"), 400);
    }

    const access = await resolveDailyAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.model || !access.canRead) {
      return fail(tRoute("noViewPermission"), 403);
    }

    if (!access.canEdit) {
      return fail(tRoute("noEditPermission"), 403);
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from("model_daily_checklist_items")
      .select("id, completed, notes")
      .eq("model_id", modelId)
      .eq("item_key", itemKey)
      .maybeSingle<{
        id: string;
        completed: boolean;
        notes: string | null;
      }>();

    if (existingError) {
      console.error("Erro ao buscar a etapa diária:", existingError);

      return fail(tRoute("stepLookupFailed"), 500);
    }

    if (!existing) {
      return fail(tRoute("stepNotFound"), 404);
    }

    const actor = {
      id: auth.profile.id,
      fullName: auth.profile.full_name || t("unknownUser"),
      role: auth.profile.role,
    };

    const title = tDaily(
      `items.${definition.sectionKey}.${definition.key}.title`,
    );

    const update: Record<string, unknown> = { updated_by: auth.user.id };

    const togglingBox =
      typeof body.completed === "boolean" &&
      body.completed !== existing.completed;

    // `notes` is absent when only the box moved, so an untouched note is never
    // rewritten — and an empty string is a real value: it clears the note.
    const nextNotes =
      typeof body.notes === "string"
        ? body.notes.trim().slice(0, DAILY_NOTE_MAX_LENGTH)
        : null;

    const previousNotes = (existing.notes ?? "").trim();

    const changingNote = nextNotes !== null && nextNotes !== previousNotes;

    // Nothing moved, so nothing is written and nothing is recorded.
    if (!togglingBox && !changingNote) {
      return respondWithCurrent(auth, modelId, access.canEdit);
    }

    if (togglingBox) {
      update.completed = body.completed;
      update.completed_by = body.completed ? auth.user.id : null;
    }

    if (changingNote) {
      update.notes = nextNotes === "" ? null : nextNotes;
    }

    const { error: updateError } = await auth.supabase
      .from("model_daily_checklist_items")
      .update(update)
      .eq("id", existing.id);

    if (updateError) {
      console.error("Erro ao atualizar a etapa diária:", updateError);

      return fail(updateError.message || tRoute("stepUpdateFailed"), 400);
    }

    // Every tick and every note lands in the model's history. Two separate
    // rows when both moved at once, so each reads on its own.
    if (togglingBox) {
      // previous/new are machine tokens, not words, and the summary is written
      // in the product's first language like every other route. Neither is what
      // the History tab shows for a daily row: it rebuilds the sentence from
      // the item key and these tokens, in the reader's language. Storing the
      // writer's language here instead would make the history read half in
      // Portuguese and half in English depending on who clicked.
      await logAuditEntry(auth.supabase, {
        modelId,
        action: DAILY_ACTION,
        fieldName: itemKey,
        previousValue: existing.completed ? "completed" : "pending",
        newValue: body.completed ? "completed" : "pending",
        actor,
        source: "api:/api/models/daily",
        summary: `Daily — "${title}" ${
          body.completed ? "marcada como concluída" : "reaberta"
        }`,
      });
    }

    if (changingNote) {
      await logAuditEntry(auth.supabase, {
        modelId,
        action: DAILY_ACTION,
        fieldName: `${itemKey}.notes`,
        previousValue: previousNotes || null,
        newValue: nextNotes || null,
        actor,
        source: "api:/api/models/daily",
        summary:
          nextNotes === ""
            ? `Daily — nota removida de "${title}"`
            : `Daily — nota em "${title}": ${excerpt(nextNotes ?? "")}`,
      });
    }

    return respondWithCurrent(auth, modelId, access.canEdit);
  } catch (error) {
    console.error("Erro ao atualizar o checklist diário:", error);

    return fail(tRoute("unexpected"), 500);
  }
}

const MAX_SUMMARY_EXCERPT = 140;

function excerpt(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();

  return collapsed.length > MAX_SUMMARY_EXCERPT
    ? `${collapsed.slice(0, MAX_SUMMARY_EXCERPT)}…`
    : collapsed;
}

/**
 * The checklist as it stands after the write. The percentage is maintained by
 * trg_daily_progress, so the sections are re-read rather than recomputed here.
 */
async function respondWithCurrent(
  auth: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    profile: ProfileRecord;
  },
  modelId: string,
  canEdit: boolean,
) {
  const { sections, summary } = await loadDaily({
    supabase: auth.supabase,
    modelId,
  });

  return NextResponse.json({
    sections,
    summary,
    canEdit,
    viewerRole: auth.profile.role,
  });
}
