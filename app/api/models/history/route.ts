import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ManagementRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

// Note events live in `model_note_history` with short action names. They are
// exposed through this endpoint under a `note_` prefix so that the unified
// history can tell them apart from profile changes in `model_audit_history`.
const NOTE_ACTION_PREFIX = "note_";

/** Catalogue keys under `admin.notes.actions`, keyed by the stored action. */
const NOTE_ACTION_KEYS: Record<string, string> = {
  created: "noteCreated",
  edited: "noteEdited",
  pinned: "notePinned",
  unpinned: "noteUnpinned",
  archived: "noteArchived",
  restored: "noteRestored",
};

const MAX_SUMMARY_EXCERPT = 140;

function excerpt(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const str = String(value).replace(/\s+/g, " ").trim();

  if (!str) {
    return null;
  }

  return str.length > MAX_SUMMARY_EXCERPT
    ? `${str.slice(0, MAX_SUMMARY_EXCERPT)}…`
    : str;
}

export async function GET(request: NextRequest) {
  const t = await getTranslations("errors.api");
  const tNoteAction = await getTranslations("admin.notes.actions");
  const tRoute = await getTranslations("errors.historyApi");
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: t("notAuthenticated") },
        { status: 401 },
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: t("invalidProfile") },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    if (role === "model") {
      return NextResponse.json(
        { error: tRoute("modelsNoAccess") },
        { status: 403 },
      );
    }

    const modelId = request.nextUrl.searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        { error: t("modelIdMissing") },
        { status: 400 },
      );
    }

    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id, representative_id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError || !model) {
      return NextResponse.json(
        { error: t("modelNotFound") },
        { status: 404 },
      );
    }

    if (
      role === "representative" &&
      model.representative_id !== user.id
    ) {
      return NextResponse.json(
        { error: t("noPermission") },
        { status: 403 },
      );
    }

    const action = request.nextUrl.searchParams.get("action");
    const fieldName = request.nextUrl.searchParams.get("fieldName");
    const actorId = request.nextUrl.searchParams.get("actorId");
    const pageStr = request.nextUrl.searchParams.get("page");
    const pageSizeStr = request.nextUrl.searchParams.get("pageSize");

    const page = Math.max(1, Number(pageStr) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(pageSizeStr) || DEFAULT_PAGE_SIZE),
    );

    const offset = (page - 1) * pageSize;

    // Both sources are ordered by created_at desc, so the first `offset +
    // pageSize` rows of each are guaranteed to contain every row that could
    // appear on the requested page of the merged list.
    const upperBound = offset + pageSize - 1;

    const isNoteAction =
      Boolean(action) && action!.startsWith(NOTE_ACTION_PREFIX);

    // Note events carry the note text itself in original_body / updated_body.
    // Notes are internal to owner/administrator, so a representative gets the
    // profile-change half of the history and never the note half. RLS on
    // model_note_history enforces the same thing independently — this is the
    // API-layer half of that pair, not a substitute for it.
    const isStaff = role === "owner" || role === "administrator";

    // A field filter only ever matches profile changes; a note-scoped action
    // filter only ever matches note events. Skip the source that cannot match.
    const skipAudit = isNoteAction;
    const skipNotes =
      !isStaff || Boolean(fieldName) || (Boolean(action) && !isNoteAction);

    const auditPromise = skipAudit
      ? null
      : (() => {
          let query = supabase
            .from("model_audit_history")
            .select(
              `
                id,
                model_id,
                action,
                field_name,
                previous_value,
                new_value,
                actor_id,
                actor_name,
                actor_role,
                source,
                summary,
                created_at
              `,
              { count: "exact" },
            )
            .eq("model_id", modelId)
            .or("source.is.null,source.neq.post_boarding")
            .order("created_at", { ascending: false })
            .range(0, upperBound);

          if (action) {
            query = query.eq("action", action);
          }

          if (fieldName) {
            query = query.eq("field_name", fieldName);
          }

          if (actorId) {
            query = query.eq("actor_id", actorId);
          }

          return query;
        })();

    const notesPromise = skipNotes
      ? null
      : (() => {
          let query = supabase
            .from("model_note_history")
            .select(
              `
                id,
                note_id,
                model_id,
                action,
                original_body,
                updated_body,
                editor_id,
                editor_name,
                editor_role,
                created_at
              `,
              { count: "exact" },
            )
            .eq("model_id", modelId)
            .order("created_at", { ascending: false })
            .range(0, upperBound);

          if (isNoteAction) {
            query = query.eq(
              "action",
              action!.slice(NOTE_ACTION_PREFIX.length),
            );
          }

          if (actorId) {
            query = query.eq("editor_id", actorId);
          }

          return query;
        })();

    const [auditResult, notesResult] = await Promise.all([
      auditPromise,
      notesPromise,
    ]);

    if (auditResult?.error) {
      console.error(
        "Failed to load the audit history:",
        auditResult.error,
      );
      return NextResponse.json(
        { error: tRoute("loadFailed") },
        { status: 500 },
      );
    }

    if (notesResult?.error) {
      console.error(
        "Failed to load the note history:",
        notesResult.error,
      );
      return NextResponse.json(
        { error: tRoute("loadFailed") },
        { status: 500 },
      );
    }

    const merged = [
      ...(auditResult?.data ?? []).map((entry) => mapAuditEntry(entry, t("unknownUser"))),
      ...(notesResult?.data ?? []).map((entry) =>
        mapNoteEntry(entry, t("unknownUser"), tNoteAction),
      ),
    ].sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    );

    const entries = merged.slice(offset, offset + pageSize);

    const totalCount =
      (auditResult?.count ?? 0) + (notesResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return NextResponse.json({
      entries,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Unexpected error loading the history:", error);

    return NextResponse.json(
      { error: tRoute("loadFailed") },
      { status: 500 },
    );
  }
}

function mapAuditEntry(
  entry: Record<string, unknown>,
  /** Shown when the row has no actor name. UI copy, so it is passed in. */
  unknownUser: string,
) {
  return {
    id: String(entry.id ?? ""),
    modelId: String(entry.model_id ?? ""),
    action: String(entry.action ?? ""),
    fieldName: entry.field_name ?? null,
    previousValue: entry.previous_value ?? null,
    newValue: entry.new_value ?? null,
    actorId: entry.actor_id ?? null,
    actorName: String(entry.actor_name ?? unknownUser),
    actorRole: String(entry.actor_role ?? "administrator"),
    source: entry.source ?? null,
    summary: String(entry.summary ?? ""),
    createdAt: String(entry.created_at ?? new Date().toISOString()),
  };
}

function mapNoteEntry(
  entry: Record<string, unknown>,
  /** See mapAuditEntry. */
  unknownUser: string,
  /** Resolves an `admin.notes.actions` key. UI copy, so it is passed in. */
  actionLabel: (key: string) => string,
) {
  const rawAction = String(entry.action ?? "");
  const label = actionLabel(NOTE_ACTION_KEYS[rawAction] ?? "noteUpdated");

  // For a brand-new note the body arrives in `updated_body`; for edits the
  // previous text is in `original_body`. Show whichever represents the note
  // as it stands after the event.
  const body =
    excerpt(entry.updated_body) ?? excerpt(entry.original_body);

  return {
    id: `note:${String(entry.id ?? "")}`,
    modelId: String(entry.model_id ?? ""),
    action: `${NOTE_ACTION_PREFIX}${rawAction}`,
    fieldName: null as string | null,
    previousValue: entry.original_body ?? null,
    newValue: entry.updated_body ?? null,
    actorId: entry.editor_id ?? null,
    actorName: String(entry.editor_name ?? unknownUser),
    actorRole: String(entry.editor_role ?? "administrator"),
    source: "notes" as string | null,
    summary: body ? `${label}: ${body}` : label,
    createdAt: String(entry.created_at ?? new Date().toISOString()),
  };
}
