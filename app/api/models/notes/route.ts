import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateManagementRequest } from "@/lib/api/auth";

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

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
) {
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
                        "O identificador da modelo é obrigatório.",
                },
                {
                    status: 400,
                },
            );
        }

        const adminSupabase =
            createAdminClient();

        const modelAccess =
            await verifyModelAccess(
                adminSupabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        const {
            data: notes,
            error: notesError,
        } = await adminSupabase
            .from("model_notes")
            .select(
                `
                    id,
                    model_id,
                    body,
                    priority,
                    pinned,
                    archived,
                    created_by,
                    created_by_name,
                    created_by_role,
                    updated_by,
                    updated_by_name,
                    updated_by_role,
                    created_at,
                    updated_at
                `,
            )
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
                        "Não foi possível carregar as notas.",
                },
                {
                    status: 500,
                },
            );
        }

        const {
            data: history,
            error: historyError,
        } = await adminSupabase
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
                        "Não foi possível carregar o histórico das notas.",
                },
                {
                    status: 500,
                },
            );
        }

        return NextResponse.json({
            notes: (notes ?? []).map(
                mapNote,
            ),
            recentHistory: (
                history ?? []
            ).map(mapHistory),
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
    try {
        const authentication =
            await getAuthenticatedProfile();

        if (!authentication.ok) {
            return authentication.response;
        }

        const { profile } = authentication;

        if (
            profile.role !== "owner" &&
            profile.role !==
                "administrator"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Você não tem permissão para adicionar notas.",
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
                        "O identificador da modelo é obrigatório.",
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
                        "A nota não pode ficar vazia.",
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
                        "A nota não pode ultrapassar 5000 caracteres.",
                },
                {
                    status: 400,
                },
            );
        }

        const adminSupabase =
            createAdminClient();

        const modelAccess =
            await verifyModelAccess(
                adminSupabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        const {
            data: createdNote,
            error: createError,
        } = await adminSupabase
            .from("model_notes")
            .insert({
                model_id: modelId,
                body,
                priority,
                pinned: false,
                archived: false,
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
            .select(
                `
                    id,
                    model_id,
                    body,
                    priority,
                    pinned,
                    archived,
                    created_by,
                    created_by_name,
                    created_by_role,
                    updated_by,
                    updated_by_name,
                    updated_by_role,
                    created_at,
                    updated_at
                `,
            )
            .single();

        if (createError || !createdNote) {
            console.error(
                "Erro ao criar nota:",
                createError,
            );

            return NextResponse.json(
                {
                    error:
                        "Não foi possível adicionar a nota.",
                },
                {
                    status: 500,
                },
            );
        }

        const historyError =
            await createHistoryEntry(
                adminSupabase,
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
            await adminSupabase
                .from("model_notes")
                .delete()
                .eq(
                    "id",
                    createdNote.id,
                );

            return NextResponse.json(
                {
                    error:
                        "A nota não foi salva porque não foi possível registrar o histórico.",
                },
                {
                    status: 500,
                },
            );
        }

        await updateLatestNoteSummary(
            adminSupabase,
            modelId,
        );

        return NextResponse.json(
            {
                note: mapNote(
                    createdNote,
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
                        "Modelo, nota e ação são obrigatórios.",
                },
                {
                    status: 400,
                },
            );
        }

        const adminSupabase =
            createAdminClient();

        const modelAccess =
            await verifyModelAccess(
                adminSupabase,
                modelId,
                profile,
            );

        if (!modelAccess.ok) {
            return modelAccess.response;
        }

        const {
            data: existingNote,
            error: existingNoteError,
        } = await adminSupabase
            .from("model_notes")
            .select(
                `
                    id,
                    model_id,
                    body,
                    priority,
                    pinned,
                    archived,
                    created_by,
                    created_by_name,
                    created_by_role,
                    updated_by,
                    updated_by_name,
                    updated_by_role,
                    created_at,
                    updated_at
                `,
            )
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
                        "A nota solicitada não foi encontrada.",
                },
                {
                    status: 404,
                },
            );
        }

        if (action === "edit") {
            return editNote({
                adminSupabase,
                profile,
                existingNote,
                modelId,
                requestBody,
            });
        }

        if (action === "pin") {
            return togglePin({
                adminSupabase,
                profile,
                existingNote,
                modelId,
                requestBody,
            });
        }

        if (action === "archive") {
            return toggleArchive({
                adminSupabase,
                profile,
                existingNote,
                modelId,
                requestBody,
            });
        }

        return NextResponse.json(
            {
                error:
                    "A ação solicitada não é válida.",
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

async function editNote({
    adminSupabase,
    profile,
    existingNote,
    modelId,
    requestBody,
}: {
    adminSupabase: ReturnType<
        typeof createAdminClient
    >;
    profile: AuthenticatedProfile;
    existingNote: Record<
        string,
        unknown
    >;
    modelId: string;
    requestBody: NotesRequestBody;
}) {
    if (profile.role !== "owner") {
        return NextResponse.json(
            {
                error:
                    "Somente o proprietário pode editar notas existentes.",
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
                    "A nota não pode ficar vazia.",
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
                    "A nota não pode ultrapassar 5000 caracteres.",
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
            note: mapNote(existingNote),
        });
    }

    const {
        data: updatedNote,
        error: updateError,
    } = await adminSupabase
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
        .select(
            `
                id,
                model_id,
                body,
                priority,
                pinned,
                archived,
                created_by,
                created_by_name,
                created_by_role,
                updated_by,
                updated_by_name,
                updated_by_role,
                created_at,
                updated_at
            `,
        )
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao editar nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    "Não foi possível editar a nota.",
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            adminSupabase,
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
        await adminSupabase
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
                    "A edição não foi salva porque não foi possível registrar o histórico.",
            },
            {
                status: 500,
            },
        );
    }

    await updateLatestNoteSummary(
        adminSupabase,
        modelId,
    );

    return NextResponse.json({
        note: mapNote(updatedNote),
    });
}

async function togglePin({
    adminSupabase,
    profile,
    existingNote,
    modelId,
    requestBody,
}: {
    adminSupabase: ReturnType<
        typeof createAdminClient
    >;
    profile: AuthenticatedProfile;
    existingNote: Record<
        string,
        unknown
    >;
    modelId: string;
    requestBody: NotesRequestBody;
}) {
    if (
        profile.role !== "owner" &&
        profile.role !==
            "administrator"
    ) {
        return NextResponse.json(
            {
                error:
                    "Você não tem permissão para fixar notas.",
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
    } = await adminSupabase
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
        .select(
            `
                id,
                model_id,
                body,
                priority,
                pinned,
                archived,
                created_by,
                created_by_name,
                created_by_role,
                updated_by,
                updated_by_name,
                updated_by_role,
                created_at,
                updated_at
            `,
        )
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao fixar nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    "Não foi possível alterar a fixação da nota.",
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            adminSupabase,
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
                    "A nota foi atualizada, mas não foi possível registrar o histórico.",
            },
            {
                status: 500,
            },
        );
    }

    return NextResponse.json({
        note: mapNote(updatedNote),
    });
}

async function toggleArchive({
    adminSupabase,
    profile,
    existingNote,
    modelId,
    requestBody,
}: {
    adminSupabase: ReturnType<
        typeof createAdminClient
    >;
    profile: AuthenticatedProfile;
    existingNote: Record<
        string,
        unknown
    >;
    modelId: string;
    requestBody: NotesRequestBody;
}) {
    if (
        profile.role !== "owner" &&
        profile.role !==
            "administrator"
    ) {
        return NextResponse.json(
            {
                error:
                    "Você não tem permissão para arquivar notas.",
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
    } = await adminSupabase
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
        .select(
            `
                id,
                model_id,
                body,
                priority,
                pinned,
                archived,
                created_by,
                created_by_name,
                created_by_role,
                updated_by,
                updated_by_name,
                updated_by_role,
                created_at,
                updated_at
            `,
        )
        .single();

    if (updateError || !updatedNote) {
        console.error(
            "Erro ao arquivar nota:",
            updateError,
        );

        return NextResponse.json(
            {
                error:
                    "Não foi possível alterar o arquivamento da nota.",
            },
            {
                status: 500,
            },
        );
    }

    const historyError =
        await createHistoryEntry(
            adminSupabase,
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
                    "A nota foi atualizada, mas não foi possível registrar o histórico.",
            },
            {
                status: 500,
            },
        );
    }

    await updateLatestNoteSummary(
        adminSupabase,
        modelId,
    );

    return NextResponse.json({
        note: mapNote(updatedNote),
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
    const auth =
        await authenticateManagementRequest({
            allowedRoles,
            fullNameFallback: "Usuário",
            messages: {
                unauthenticated:
                    "Sua sessão expirou. Entre novamente.",
                inactiveProfile:
                    "Seu perfil não está ativo.",
                forbidden:
                    "Você não tem acesso às notas administrativas.",
            },
        });

    if (!auth.ok) {
        return {
            ok: false,
            response: auth.response,
        };
    }

    return {
        ok: true,
        profile: {
            id: auth.profile.id,
            fullName: auth.profile.fullName,
            role: auth.profile.role,
        },
    };
}

async function verifyModelAccess(
    adminSupabase: ReturnType<
        typeof createAdminClient
    >,
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
    const {
        data: model,
        error: modelError,
    } = await adminSupabase
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
                            "A modelo solicitada não foi encontrada.",
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
            data: assignment,
            error: assignmentError,
        } = await adminSupabase
            .from(
                "representative_assignments",
            )
            .select("id")
            .eq("model_id", modelId)
            .eq(
                "representative_id",
                profile.id,
            )
            .eq("active", true)
            .maybeSingle();

        if (
            assignmentError ||
            !assignment
        ) {
            return {
                ok: false,
                response:
                    NextResponse.json(
                        {
                            error:
                                "Você não tem acesso a esta modelo.",
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
    adminSupabase: ReturnType<
        typeof createAdminClient
    >,
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
    const { error } = await adminSupabase
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
    adminSupabase: ReturnType<
        typeof createAdminClient
    >,
    modelId: string,
) {
    const {
        data: latestNote,
        error: noteError,
    } = await adminSupabase
        .from("model_notes")
        .select("body")
        .eq("model_id", modelId)
        .eq("archived", false)
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
        await adminSupabase
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
    return {
        canCreate:
            role === "owner" ||
            role ===
                "administrator",
        canEdit: role === "owner",
        canPin:
            role === "owner" ||
            role ===
                "administrator",
        canArchive:
            role === "owner" ||
            role ===
                "administrator",
    };
}

function mapNote(
    note: Record<string, unknown>,
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
        createdByName:
            readRequiredString(
                note.created_by_name,
            ) ?? "Usuário",
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
            ) ?? "Usuário",
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