import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

type ManagementRole =
    | "owner"
    | "administrator"
    | "representative"
    | "model";

type NotePriority =
    | "normal"
    | "important"
    | "urgent";

type NotesRequestBody = {
    modelId?: unknown;
    noteId?: unknown;
    action?: unknown;
    body?: unknown;
    priority?: unknown;
    pinned?: unknown;
    archived?: unknown;
};

type AuthenticatedProfile = {
    id: string;
    fullName: string;
    role: ManagementRole;
};

// Notes are internal agency records: owner, administrator, and the model's
// assigned representative (who may read only their own notes). RLS enforces
// the rep boundary, so the API lets them in and trusts the database filter.
const allowedRoles: ManagementRole[] = [
    "owner",
    "administrator",
    "representative",
];

const notePriorities: NotePriority[] = [
    "normal",
    "important",
    "urgent",
];

const NOTE_COLUMNS = `
    id,
    model_id,
    body,
    priority,
    pinned,
    archived,
    deleted_at,
    deleted_by,
    deleted_by_name,
    created_context,
    source,
    ledger_entry_id,
    created_by,
    created_by_name,
    created_by_role,
    updated_by,
    updated_by_name,
    updated_by_role,
    previous_representative_id,
    new_representative_id,
    created_at,
    updated_at
`;

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
) {
  const t = await getTranslations("errors.api");
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    try {
        const authentication =
            await getAuthenticatedProfile();

        if (!authentication.ok) {
            return authentication.response;
        }

        const { profile } = authentication;

        const modelId =
            request.nextUrl.searchParams.get(
                "modelId",
            );

        if (!modelId) {
            return NextResponse.json(
                {
                    error:
                        t("modelIdRequired"),
                },
                {
                    status: 400,
                },
            );
        }

        const supabase = await createClient();

        const modelAccess =
            await verifyModelAccess(
                supabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        // Use request-scoped client for data access (RLS enforced)
        const isRep = profile.role === "representative";

        const {
            data: notes,
            error: notesError,
        } = await supabase
            .from("model_notes")
            .select(NOTE_COLUMNS)
            .eq("model_id", modelId)
            .order("pinned", {
                ascending: false,
            })
            .order("updated_at", {
                ascending: false,
            });

        if (notesError) {
            console.error(
                "Erro ao carregar notas:",
                notesError,
            );

            return NextResponse.json(
                {
                    error:
                        tRoute("loadFailed"),
                },
                {
                    status: 500,
                },
            );
        }

        // The note history and full audit trail are internal agency records.
        // Representatives read only their own notes; they do not see the history.
        let history: Record<string, unknown>[] = [];
        let auditHistory: Record<string, unknown>[] = [];

        if (!isRep) {
            const {
                data: historyData,
                error: historyError,
            } = await supabase
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
                )
                .eq("model_id", modelId)
                .order("created_at", {
                    ascending: false,
                })
                .limit(100);

            if (historyError) {
                console.error(
                    "Erro ao carregar histórico das notas:",
                    historyError,
                );

                return NextResponse.json(
                    {
                        error:
                            tRoute("historyLoadFailed"),
                    },
                    {
                        status: 500,
                    },
                );
            }

            history = historyData ?? [];

            // The recent-history panel shows the same unified timeline as the
            // Histórico tab: note events plus every other change to the account.
            // Models are excluded from `model_audit_history` by RLS, so for them
            // this simply comes back empty rather than erroring.
            const {
                data: auditData,
                error: auditHistoryError,
            } = await supabase
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
                        summary,
                        created_at
                    `,
                )
                .eq("model_id", modelId)
                .order("created_at", {
                    ascending: false,
                })
                .limit(100);

            if (auditHistoryError) {
                console.error(
                    "Erro ao carregar histórico de auditoria das notas:",
                    auditHistoryError,
                );
            }

            auditHistory = auditData ?? [];
        }

        const recentHistory = [
            ...(history ?? []).map(
                (entry) =>
                    mapHistory(
                        entry,
                        tRoute(
                            "unknownUser",
                        ),
                    ),
            ),
            ...(
                auditHistory ?? []
            ).map((entry) =>
                mapAuditHistory(
                    entry,
                    tRoute(
                        "unknownUser",
                    ),
                ),
            ),
        ]
            .sort(
                (first, second) =>
                    new Date(
                        second.createdAt,
                    ).getTime() -
                    new Date(
                        first.createdAt,
                    ).getTime(),
            )
            .slice(0, 100);

        return NextResponse.json({
            notes: (notes ?? []).map(
                (note) =>
                    mapNote(
                        note,
                        tRoute(
                            "unknownUser",
                        ),
                    ),
            ),
            recentHistory,
            permissions:
                createPermissions(profile.role),
        });
    } catch (error) {
        console.error(
            "Erro inesperado ao carregar notas:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    "Ocorreu um erro inesperado ao carregar as notas.",
            },
            {
                status: 500,
            },
        );
    }
}

export async function POST(
    request: NextRequest,
) {
  const t = await getTranslations("errors.api");
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    try {
        const authentication =
            await getAuthenticatedProfile();

        if (!authentication.ok) {
            return authentication.response;
        }

        const { profile } = authentication;
        const isStaff =
            profile.role === "owner" ||
            profile.role === "administrator";

        const requestBody =
            (await request.json()) as NotesRequestBody;

        const modelId = readRequiredString(
            requestBody.modelId,
        );

        const body = readRequiredString(
            requestBody.body,
        );

        const priority = normalizePriority(
            requestBody.priority,
        );

        if (!modelId) {
            return NextResponse.json(
                {
                    error:
                        t("modelIdRequired"),
                },
                {
                    status: 400,
                },
            );
        }

        if (!body) {
            return NextResponse.json(
                {
                    error:
                        tRoute("noteEmpty"),
                },
                {
                    status: 400,
                },
            );
        }

        if (body.length > 5000) {
            return NextResponse.json(
                {
                    error:
                        tRoute("noteTooLong"),
                },
                {
                    status: 400,
                },
            );
        }

        const supabase =
            await createClient();

        const modelAccess =
            await verifyModelAccess(
                supabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        const {
            data: createdNote,
            error: createError,
        } = await supabase
            .from("model_notes")
            .insert({
                model_id: modelId,
                body,
                priority,
                pinned: false,
                archived: false,
                created_context:
                    isStaff ? "staff" : "representative",
                created_by: profile.id,
                created_by_name:
                    profile.fullName,
                created_by_role:
                    profile.role,
                updated_by: profile.id,
                updated_by_name:
                    profile.fullName,
                updated_by_role:
                    profile.role,
            })
            .select(NOTE_COLUMNS)
            .single();

        if (createError || !createdNote) {
            console.error(
                "Erro ao criar nota:",
                createError,
            );

            return NextResponse.json(
                {
                    error:
                        tRoute("addFailed"),
                },
                {
                    status: 500,
                },
            );
        }

        // Every note is recorded, whoever wrote it. This used to skip the
        // history for a representative because RLS refused her the insert; the
        // representative_notes migration lets an assigned rep record her own
        // note, so a rep's note is no longer the one kind with no trail.
        const historyError = await createHistoryEntry(
            supabase,
            {
                noteId: createdNote.id,
                modelId,
                action: "created",
                originalBody: null,
                updatedBody: body,
                profile,
            },
        );

        if (historyError) {
            await supabase
                .from("model_notes")
                .delete()
                .eq(
                    "id",
                    createdNote.id,
                );

            return NextResponse.json(
                {
                    error:
                        tRoute("addHistoryFailed"),
                },
                {
                    status: 500,
                },
            );
        }

        await updateLatestNoteSummary(
            supabase,
            modelId,
        );

        return NextResponse.json(
            {
                note: mapNote(
                    createdNote,
                    tRoute("unknownUser"),
                ),
            },
            {
                status: 201,
            },
        );
    } catch (error) {
        console.error(
            "Erro inesperado ao criar nota:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    "Ocorreu um erro inesperado ao adicionar a nota.",
            },
            {
                status: 500,
            },
        );
    }
}

export async function PATCH(
    request: NextRequest,
) {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    try {
        const authentication =
            await getAuthenticatedProfile();

        if (!authentication.ok) {
            return authentication.response;
        }

        const { profile } = authentication;

        const requestBody =
            (await request.json()) as NotesRequestBody;

        const modelId = readRequiredString(
            requestBody.modelId,
        );

        const noteId = readRequiredString(
            requestBody.noteId,
        );

        const action = readRequiredString(
            requestBody.action,
        );

        if (
            !modelId ||
            !noteId ||
            !action
        ) {
            return NextResponse.json(
                {
                    error:
                        tRoute("modelNoteActionRequired"),
                },
                {
                    status: 400,
                },
            );
        }

        const supabase =
            await createClient();

        const modelAccess =
            await verifyModelAccess(
                supabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        const {
            data: existingNote,
            error: existingNoteError,
        } = await supabase
            .from("model_notes")
            .select(NOTE_COLUMNS)
            .eq("id", noteId)
            .eq("model_id", modelId)
            .single();

        if (
            existingNoteError ||
            !existingNote
        ) {
            return NextResponse.json(
                {
                    error:
                        tRoute("noteNotFound"),
                },
                {
                    status: 404,
                },
            );
        }

        if (action === "edit") {
            return editNote({
                supabase,
                profile,
                existingNote,
                modelId,
                requestBody,
            });
        }

        if (action === "pin") {
            return togglePin({
                supabase,
                profile,
                existingNote,
                modelId,
                requestBody,
            });
        }

        if (action === "archive") {
            return toggleArchive({
                supabase,
                profile,
                existingNote,
                modelId,
                requestBody,
            });
        }

        if (action === "soft-delete") {
            return softDeleteNote({
                supabase,
                profile,
                existingNote,
                modelId,
            });
        }

        return NextResponse.json(
            {
                error:
                    tRoute("invalidAction"),
            },
            {
                status: 400,
            },
        );
    } catch (error) {
        console.error(
            "Erro inesperado ao atualizar nota:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    "Ocorreu um erro inesperado ao atualizar a nota.",
            },
            {
                status: 500,
            },
        );
    }
}

/**
 * Owner-only. Deletes any note; when the note is a financial one
 * (source = 'ledger') the linked expense/loan is soft-deleted in the same
 * transaction, so it also disappears from the model's Despesas / Empréstimos
 * and stops being deducted from her month. See delete_model_note.
 */
export async function DELETE(
    request: NextRequest,
) {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    try {
        const authentication =
            await getAuthenticatedProfile();

        if (!authentication.ok) {
            return authentication.response;
        }

        const { profile } = authentication;

        if (profile.role !== "owner") {
            return NextResponse.json(
                {
                    error:
                        tRoute("ownerOnlyDelete"),
                },
                {
                    status: 403,
                },
            );
        }

        const requestBody =
            (await request.json()) as NotesRequestBody;

        const modelId = readRequiredString(
            requestBody.modelId,
        );

        const noteId = readRequiredString(
            requestBody.noteId,
        );

        if (!modelId || !noteId) {
            return NextResponse.json(
                {
                    error:
                        tRoute("modelAndNoteRequired"),
                },
                {
                    status: 400,
                },
            );
        }

        const supabase =
            await createClient();

        const modelAccess =
            await verifyModelAccess(
                supabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        const {
            data: existingNote,
            error: existingNoteError,
        } = await supabase
            .from("model_notes")
            .select("id, source, ledger_entry_id")
            .eq("id", noteId)
            .eq("model_id", modelId)
            .maybeSingle();

        if (
            existingNoteError ||
            !existingNote
        ) {
            return NextResponse.json(
                {
                    error:
                        tRoute("noteNotFound"),
                },
                {
                    status: 404,
                },
            );
        }

        const { data, error } =
            await supabase.rpc(
                "delete_model_note",
                {
                    p_note_id: noteId,
                },
            );

        if (error) {
            console.error(
                "Erro ao excluir nota:",
                error,
            );

            return NextResponse.json(
                {
                    error:
                        error.code === "42501"
                            ? tRoute("ownerOnlyDelete")
                            : tRoute("deleteFailed"),
                },
                {
                    status:
                        error.code === "42501"
                            ? 403
                            : 500,
                },
            );
        }

        const result = (data ?? {}) as {
            ledger_entry_id?: string | null;
        };

        return NextResponse.json({
            success: true,
            // Non-null when an expense/loan was removed alongside the note.
            ledgerEntryId:
                result.ledger_entry_id ?? null,
        });
    } catch (error) {
        console.error(
            "Erro inesperado ao excluir nota:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    "Ocorreu um erro inesperado ao excluir a nota.",
            },
            {
                status: 500,
            },
        );
    }
}

async function editNote({
    supabase,
    profile,
    existingNote,
    modelId,
    requestBody,
}: {
    supabase: SupabaseClient;
    profile: AuthenticatedProfile;
    existingNote: Record<
        string,
        unknown
    >;
    modelId: string;
    requestBody: NotesRequestBody;
}) {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    // The owner edits any note. A representative edits the ones she wrote, on
    // a model still assigned to her, and only while they are not deleted —
    // checked here, then again by notes_update and by the
    // guard_note_representative_update trigger, which narrows her to the text.
    // An administrator edits none: an admin who disagrees with a note adds one.
    const isOwner = profile.role === "owner";
    const isAuthoringRep =
        profile.role === "representative" &&
        readRequiredString(existingNote.created_by) === profile.id &&
        !existingNote.deleted_at;

    if (!isOwner && !isAuthoringRep) {
        return NextResponse.json(
            {
                error:
                    profile.role === "representative"
                        ? tRoute("editOwnNotesOnly")
                        : tRoute("ownerOnlyEdit"),
            },
            {
                status: 403,
            },
        );
    }

    const body = readRequiredString(
        requestBody.body,
    );

    const priority = normalizePriority(
        requestBody.priority,
    );

    if (!body) {
        return NextResponse.json(
            {
                error:
                    tRoute("noteEmpty"),
            },
            {
                status: 400,
            },
        );
    }

    if (body.length > 5000) {
        return NextResponse.json(
            {
                error:
                    tRoute("noteTooLong"),
            },
            {
                status: 400,
            },
        );
    }

    const originalBody =
        readRequiredString(
            existingNote.body,
        ) ?? "";

    const existingPriority =
        normalizePriority(
            existingNote.priority,
        );

    if (
        body === originalBody &&
        priority === existingPriority
    ) {
        return NextResponse.json({
            note: mapNote(
            existingNote,
            tRoute("unknownUser"),
        ),
        });
    }

    const {
        data: updatedNote,
        error: updateError,
    } = await supabase
        .from("model_notes")
        .update({
            body,
            priority,
            updated_by: profile.id,
            updated_by_name:
                profile.fullName,
            updated_by_role:
                profile.role,
            updated_at:
                new Date().toISOString(),
        })
        .eq("id", existingNote.id)
        .eq("model_id", modelId)
        .select(NOTE_COLUMNS)
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao editar nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    tRoute("editFailed"),
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            supabase,
            {
                noteId: String(
                    existingNote.id,
                ),
                modelId,
                action: "edited",
                originalBody,
                updatedBody: body,
                profile,
            },
        );

    if (historyError) {
        await supabase
            .from("model_notes")
            .update({
                body: originalBody,
                priority:
                    existingPriority,
            })
            .eq(
                "id",
                existingNote.id,
            );

        return NextResponse.json(
            {
                error:
                    tRoute("editHistoryFailed"),
            },
            {
                status: 500,
            },
        );
    }

    await updateLatestNoteSummary(
        supabase,
        modelId,
    );

    return NextResponse.json({
        note: mapNote(
            updatedNote,
            tRoute("unknownUser"),
        ),
    });
}

async function togglePin({
    supabase,
    profile,
    existingNote,
    modelId,
    requestBody,
}: {
    supabase: SupabaseClient;
    profile: AuthenticatedProfile;
    existingNote: Record<
        string,
        unknown
    >;
    modelId: string;
    requestBody: NotesRequestBody;
}) {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    if (
        profile.role !== "owner" &&
        profile.role !==
            "administrator"
    ) {
        return NextResponse.json(
            {
                error:
                    tRoute("noPinPermission"),
            },
            {
                status: 403,
            },
        );
    }

    const pinned =
        typeof requestBody.pinned ===
        "boolean"
            ? requestBody.pinned
            : !Boolean(
                  existingNote.pinned,
              );

    const {
        data: updatedNote,
        error: updateError,
    } = await supabase
        .from("model_notes")
        .update({
            pinned,
            updated_by: profile.id,
            updated_by_name:
                profile.fullName,
            updated_by_role:
                profile.role,
            updated_at:
                new Date().toISOString(),
        })
        .eq("id", existingNote.id)
        .eq("model_id", modelId)
        .select(NOTE_COLUMNS)
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao fixar nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    tRoute("pinFailed"),
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            supabase,
            {
                noteId: String(
                    existingNote.id,
                ),
                modelId,
                action: pinned
                    ? "pinned"
                    : "unpinned",
                originalBody:
                    readRequiredString(
                        existingNote.body,
                    ),
                updatedBody:
                    readRequiredString(
                        existingNote.body,
                    ),
                profile,
            },
        );

    if (historyError) {
        return NextResponse.json(
            {
                error:
                    tRoute("updateHistoryFailed"),
            },
            {
                status: 500,
            },
        );
    }

    return NextResponse.json({
        note: mapNote(
            updatedNote,
            tRoute("unknownUser"),
        ),
    });
}

async function toggleArchive({
    supabase,
    profile,
    existingNote,
    modelId,
    requestBody,
}: {
    supabase: SupabaseClient;
    profile: AuthenticatedProfile;
    existingNote: Record<
        string,
        unknown
    >;
    modelId: string;
    requestBody: NotesRequestBody;
}) {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    if (
        profile.role !== "owner" &&
        profile.role !==
            "administrator"
    ) {
        return NextResponse.json(
            {
                error:
                    tRoute("noArchivePermission"),
            },
            {
                status: 403,
            },
        );
    }

    const archived =
        typeof requestBody.archived ===
        "boolean"
            ? requestBody.archived
            : !Boolean(
                  existingNote.archived,
              );

    const {
        data: updatedNote,
        error: updateError,
    } = await supabase
        .from("model_notes")
        .update({
            archived,
            updated_by: profile.id,
            updated_by_name:
                profile.fullName,
            updated_by_role:
                profile.role,
            updated_at:
                new Date().toISOString(),
        })
        .eq("id", existingNote.id)
        .eq("model_id", modelId)
        .select(NOTE_COLUMNS)
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao arquivar nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    tRoute("archiveFailed"),
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            supabase,
            {
                noteId: String(
                    existingNote.id,
                ),
                modelId,
                action: archived
                    ? "archived"
                    : "restored",
                originalBody:
                    readRequiredString(
                        existingNote.body,
                    ),
                updatedBody:
                    readRequiredString(
                        existingNote.body,
                    ),
                profile,
            },
        );

    if (historyError) {
        return NextResponse.json(
            {
                error:
                    tRoute("updateHistoryFailed"),
            },
            {
                status: 500,
            },
        );
    }

    await updateLatestNoteSummary(
        supabase,
        modelId,
    );

    return NextResponse.json({
        note: mapNote(
            updatedNote,
            tRoute("unknownUser"),
        ),
    });
}

async function softDeleteNote({
    supabase,
    profile,
    existingNote,
    modelId,
}: {
    supabase: SupabaseClient;
    profile: AuthenticatedProfile;
    existingNote: Record<string, unknown>;
    modelId: string;
}) {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    if (profile.role !== "owner") {
        return NextResponse.json(
            {
                error:
                    tRoute("ownerOnlyDelete"),
            },
            {
                status: 403,
            },
        );
    }

    if (existingNote.deleted_at) {
        return NextResponse.json(
            {
                error:
                    tRoute("alreadyDeleted"),
            },
            {
                status: 400,
            },
        );
    }

    const {
        data: updatedNote,
        error: updateError,
    } = await supabase
        .from("model_notes")
        .update({
            archived: true,
            deleted_at:
                new Date().toISOString(),
            deleted_by: profile.id,
            deleted_by_name:
                profile.fullName,
            updated_by: profile.id,
            updated_by_name:
                profile.fullName,
            updated_by_role:
                profile.role,
            updated_at:
                new Date().toISOString(),
        })
        .eq("id", existingNote.id)
        .eq("model_id", modelId)
        .select(NOTE_COLUMNS)
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao excluir nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    tRoute("deleteFailed"),
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            supabase,
            {
                noteId: String(
                    existingNote.id,
                ),
                modelId,
                action: "soft_deleted",
                originalBody:
                    readRequiredString(
                        existingNote.body,
                    ) ?? "",
                updatedBody: null,
                profile,
            },
        );

    if (historyError) {
        // Best-effort history; the note is already soft-deleted.
        console.error(
            "Erro ao registrar histórico de exclusão suave:",
            historyError,
        );
    }

    await updateLatestNoteSummary(
        supabase,
        modelId,
    );

    return NextResponse.json({
        note: mapNote(
            updatedNote,
            tRoute("unknownUser"),
        ),
    });
}

async function getAuthenticatedProfile(): Promise<
    | {
          ok: true;
          profile: AuthenticatedProfile;
      }
    | {
          ok: false;
          response: NextResponse;
      }
> {
    const t = await getTranslations("errors.api");
    const tRoute = await getTranslations(
        "errors.notesApi",
    );


    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return {
            ok: false,
            response:
                NextResponse.json(
                    {
                        error:
                            t("sessionExpired"),
                    },
                    {
                        status: 401,
                    },
                ),
        };
    }

    const {
        data: profile,
        error: profileError,
    } = await supabase
        .from("profiles")
        .select(
            "id, full_name, role, active, status",
        )
        .eq("id", user.id)
        .single();

    if (
        profileError ||
        !profile ||
        !profile.active
    ) {
        return {
            ok: false,
            response:
                NextResponse.json(
                    {
                        error:
                            t("profileInactive"),
                    },
                    {
                        status: 403,
                    },
                ),
        };
    }

    const role =
        profile.role as ManagementRole;

    if (
        role === "representative" &&
        profile.status !== "ativa"
    ) {
        return {
            ok: false,
            response:
                NextResponse.json(
                    {
                        error:
                            "Representante inativo.",
                    },
                    {
                        status: 403,
                    },
                ),
        };
    }

    if (!allowedRoles.includes(role)) {
        return {
            ok: false,
            response:
                NextResponse.json(
                    {
                        error:
                            tRoute("noAdminNotesAccess"),
                    },
                    {
                        status: 403,
                    },
                ),
        };
    }

    return {
        ok: true,
        profile: {
            id: profile.id,
            fullName:
                profile.full_name ||
                "Usuário",
            role,
        },
    };
}

async function verifyModelAccess(
    supabase: SupabaseClient,
    modelId: string,
    profile: AuthenticatedProfile,
): Promise<
    | {
          ok: true;
      }
    | {
          ok: false;
          response: NextResponse;
      }
> {
    const tRoute = await getTranslations(
        "errors.notesApi",
    );

    const {
        data: model,
        error: modelError,
    } = await supabase
        .from("models")
        .select("id")
        .eq("id", modelId)
        .single();

    if (modelError || !model) {
        return {
            ok: false,
            response:
                NextResponse.json(
                    {
                        error:
                            tRoute("modelNotFound"),
                    },
                    {
                        status: 404,
                    },
                ),
        };
    }

    if (
        profile.role ===
        "representative"
    ) {
        const {
            data: repModel,
            error: repModelError,
        } = await supabase
            .from("models")
            .select("id")
            .eq("id", modelId)
            .eq(
                "representative_id",
                profile.id,
            )
            .maybeSingle();

        if (
            repModelError ||
            !repModel
        ) {
            return {
                ok: false,
                response:
                    NextResponse.json(
                        {
                            error:
                                tRoute("noModelAccess"),
                        },
                        {
                            status: 403,
                        },
                    ),
            };
        }
    }

    return {
        ok: true,
    };
}

async function createHistoryEntry(
    supabase: SupabaseClient,
    {
        noteId,
        modelId,
        action,
        originalBody,
        updatedBody,
        profile,
    }: {
        noteId: string;
        modelId: string;
        action: string;
        originalBody: string | null;
        updatedBody: string | null;
        profile: AuthenticatedProfile;
    },
) {
    const { error } = await supabase
        .from("model_note_history")
        .insert({
            note_id: noteId,
            model_id: modelId,
            action,
            original_body:
                originalBody,
            updated_body:
                updatedBody,
            editor_id: profile.id,
            editor_name:
                profile.fullName,
            editor_role:
                profile.role,
        });

    if (error) {
        console.error(
            "Erro ao registrar histórico da nota:",
            error,
        );

        return error;
    }

    return null;
}

async function updateLatestNoteSummary(
    supabase: SupabaseClient,
    modelId: string,
) {

    const {
        data: latestNote,
        error: noteError,
    } = await supabase
        .from("model_notes")
        .select("body")
        .eq("model_id", modelId)
        .eq("archived", false)
        .is("deleted_at", null)
        .order("pinned", {
            ascending: false,
        })
        .order("updated_at", {
            ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (noteError) {
        console.error(
            "Erro ao buscar resumo da última nota:",
            noteError,
        );

        return;
    }

    const summary =
        typeof latestNote?.body ===
        "string"
            ? latestNote.body
                  .trim()
                  .slice(0, 250)
            : null;

    const { error: modelError } =
        await supabase
            .from("models")
            .update({
                latest_note_summary:
                    summary,
            })
            .eq("id", modelId);

    if (modelError) {
        console.error(
            "Erro ao atualizar resumo da modelo:",
            modelError,
        );
    }
}

function createPermissions(
    role: ManagementRole,
) {
    const isStaff =
        role === "owner" ||
        role === "administrator";
    const isRep = role === "representative";

    return {
        canCreate: isStaff || isRep,
        // A representative may correct what she wrote — and only what she
        // wrote. RLS shows her nothing but her own notes, so this flag needs no
        // per-note qualifier on her side; the API and a database trigger check
        // authorship again on the write itself.
        canEdit: role === "owner" || isRep,
        canPin: isStaff,
        canArchive: isStaff,
        // Soft delete (Excluir) is owner-only. Admins may archive; reps may create.
        canSoftDelete: role === "owner",
        canPurge: role === "owner",
    };
}

function mapNote(
    note: Record<string, unknown>,
    unknownUser: string,
) {
    return {
        id: readRequiredString(
            note.id,
        ),
        modelId:
            readRequiredString(
                note.model_id,
            ) ?? "",
        body:
            readRequiredString(
                note.body,
            ) ?? "",
        priority:
            normalizePriority(
                note.priority,
            ),
        pinned: Boolean(
            note.pinned,
        ),
        archived: Boolean(
            note.archived,
        ),
        // 'ledger' notes are the model-facing face of an expense or loan:
        // deleting one also removes the entry, so the UI has to say so.
        source:
            note.source === "ledger"
                ? "ledger"
                : "manual",
        ledgerEntryId:
            readRequiredString(
                note.ledger_entry_id,
            ),
        createdByName:
            readRequiredString(
                note.created_by_name,
            ) ?? unknownUser,
        createdByRole:
            readRequiredString(
                note.created_by_role,
            ) ??
            "administrator",
        updatedByName:
            readRequiredString(
                note.updated_by_name,
            ),
        updatedByRole:
            readRequiredString(
                note.updated_by_role,
            ),
        createdContext:
            readRequiredString(
                note.created_context,
            ),
        previousRepresentativeId:
            readRequiredString(
                note.previous_representative_id,
            ),
        newRepresentativeId:
            readRequiredString(
                note.new_representative_id,
            ),
        deletedAt:
            note.deleted_at === null
                ? null
                : readRequiredString(
                      note.deleted_at,
                  ) ?? null,
        deletedBy:
            readRequiredString(
                note.deleted_by,
            ),
        deletedByName:
            readRequiredString(
                note.deleted_by_name,
            ),
        createdAt:
            readRequiredString(
                note.created_at,
            ) ??
            new Date().toISOString(),
        updatedAt:
            readRequiredString(
                note.updated_at,
            ) ??
            readRequiredString(
                note.created_at,
            ) ??
            new Date().toISOString(),
    };
}

function mapHistory(
    history: Record<
        string,
        unknown
    >,
    unknownUser: string,
) {
    return {
        id: readRequiredString(
            history.id,
        ),
        noteId:
            readRequiredString(
                history.note_id,
            ),
        modelId:
            readRequiredString(
                history.model_id,
            ),
        action:
            readRequiredString(
                history.action,
            ) ?? "updated",
        originalBody:
            readRequiredString(
                history.original_body,
            ),
        updatedBody:
            readRequiredString(
                history.updated_body,
            ),
        editorName:
            readRequiredString(
                history.editor_name,
            ) ?? unknownUser,
        editorRole:
            readRequiredString(
                history.editor_role,
            ) ??
            "administrator",
        createdAt:
            readRequiredString(
                history.created_at,
            ) ??
            new Date().toISOString(),
    };
}

// Reshapes a `model_audit_history` row into the same envelope the notes panel
// already renders, so account changes and note events can share one timeline.
// `summary` carries the human-readable description the audit table stores.
function mapAuditHistory(
    entry: Record<string, unknown>,
    unknownUser: string,
) {
    return {
        id: `audit:${
            readRequiredString(
                entry.id,
            ) ?? ""
        }`,
        noteId: null,
        modelId:
            readRequiredString(
                entry.model_id,
            ),
        action:
            readRequiredString(
                entry.action,
            ) ?? "field_update",
        fieldName:
            readRequiredString(
                entry.field_name,
            ),
        summary:
            readRequiredString(
                entry.summary,
            ),
        originalBody:
            readRequiredString(
                entry.previous_value,
            ),
        updatedBody:
            readRequiredString(
                entry.new_value,
            ),
        editorName:
            readRequiredString(
                entry.actor_name,
            ) ?? unknownUser,
        editorRole:
            readRequiredString(
                entry.actor_role,
            ) ??
            "administrator",
        createdAt:
            readRequiredString(
                entry.created_at,
            ) ??
            new Date().toISOString(),
    };
}

function normalizePriority(
    value: unknown,
): NotePriority {
    if (
        typeof value === "string" &&
        notePriorities.includes(
            value as NotePriority,
        )
    ) {
        return value as NotePriority;
    }

    return "normal";
}

function readRequiredString(
    value: unknown,
) {
    if (
        typeof value !== "string"
    ) {
        return null;
    }

    const normalized =
        value.trim();

    return normalized || null;
}