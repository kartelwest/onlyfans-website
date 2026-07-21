"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ManagementRole } from "@/types/model";

type NotesTabProps = {
    modelId: string;
    currentUserRole: ManagementRole;
    historyOnly?: boolean;
};

type NotePriority =
    | "normal"
    | "important"
    | "urgent";

type ModelNote = {
    id: string;
    modelId: string;
    body: string;
    priority: NotePriority;
    pinned: boolean;
    archived: boolean;
    createdByName: string;
    createdByRole: string;
    updatedByName: string | null;
    updatedByRole: string | null;
    createdAt: string;
    updatedAt: string;
};

type NoteHistory = {
    id: string;
    noteId: string | null;
    action: string;
    originalBody: string | null;
    updatedBody: string | null;
    editorName: string;
    editorRole: string;
    createdAt: string;
};

type ApiPermissions = {
    canCreate?: boolean;
    canEdit?: boolean;
    canPin?: boolean;
    canArchive?: boolean;
};

type NotesApiResponse = {
    notes?: unknown[];
    history?: unknown[];
    recentHistory?: unknown[];
    permissions?: ApiPermissions;
    error?: string;
};

const priorityOptions: {
    value: NotePriority;
    label: string;
}[] = [
    {
        value: "normal",
        label: "Normal",
    },
    {
        value: "important",
        label: "Importante",
    },
    {
        value: "urgent",
        label: "Urgente",
    },
];

export default function NotesTab({
    modelId,
    currentUserRole,
    historyOnly = false,
}: NotesTabProps) {
    const [notes, setNotes] = useState<ModelNote[]>([]);
    const [history, setHistory] = useState<NoteHistory[]>([]);

    const [permissions, setPermissions] =
        useState<ApiPermissions>({});

    const [newNoteBody, setNewNoteBody] =
        useState("");

    const [newNotePriority, setNewNotePriority] =
        useState<NotePriority>("normal");

    const [editingNote, setEditingNote] =
        useState<ModelNote | null>(null);

    const [editingBody, setEditingBody] =
        useState("");

    const [editingPriority, setEditingPriority] =
        useState<NotePriority>("normal");

    const [showArchived, setShowArchived] =
        useState(false);

    const [isLoading, setIsLoading] =
        useState(true);

    const [isSaving, setIsSaving] =
        useState(false);

    const [actionNoteId, setActionNoteId] =
        useState<string | null>(null);

    const [errorMessage, setErrorMessage] =
        useState<string | null>(null);

    const isOwner =
        currentUserRole === "owner";

    const canCreate =
        permissions.canCreate ??
        (currentUserRole === "owner" ||
            currentUserRole === "administrator");

    const canEdit =
        permissions.canEdit ?? isOwner;

    const canPin =
        permissions.canPin ??
        (currentUserRole === "owner" ||
            currentUserRole === "administrator");

    const canArchive =
        permissions.canArchive ??
        (currentUserRole === "owner" ||
            currentUserRole === "administrator");

    const loadNotes = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const response = await fetch(
                `/api/models/notes?modelId=${encodeURIComponent(
                    modelId,
                )}`,
                {
                    method: "GET",
                    cache: "no-store",
                },
            );

            const result =
                (await response.json()) as NotesApiResponse;

            if (!response.ok) {
                throw new Error(
                    result.error ??
                        "Não foi possível carregar as notas.",
                );
            }

            const rawNotes = Array.isArray(result.notes)
                ? result.notes
                : [];

            const rawHistory = Array.isArray(
                result.recentHistory,
            )
                ? result.recentHistory
                : Array.isArray(result.history)
                  ? result.history
                  : [];

            setNotes(
                rawNotes
                    .map(normalizeNote)
                    .filter(
                        (
                            note,
                        ): note is ModelNote =>
                            note !== null,
                    ),
            );

            setHistory(
                rawHistory
                    .map(normalizeHistory)
                    .filter(
                        (
                            item,
                        ): item is NoteHistory =>
                            item !== null,
                    ),
            );

            setPermissions(
                result.permissions ?? {},
            );
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido ao carregar as notas.",
            );
        } finally {
            setIsLoading(false);
        }
    }, [modelId]);

    useEffect(() => {
        void loadNotes();
    }, [loadNotes]);

    const visibleNotes = useMemo(() => {
        return notes
            .filter(
                (note) =>
                    showArchived || !note.archived,
            )
            .sort((first, second) => {
                if (
                    first.pinned !== second.pinned
                ) {
                    return first.pinned ? -1 : 1;
                }

                return (
                    new Date(
                        second.updatedAt,
                    ).getTime() -
                    new Date(
                        first.updatedAt,
                    ).getTime()
                );
            });
    }, [notes, showArchived]);

    const recentHistory = useMemo(() => {
        return [...history].sort(
            (first, second) =>
                new Date(
                    second.createdAt,
                ).getTime() -
                new Date(
                    first.createdAt,
                ).getTime(),
        );
    }, [history]);

    async function createNote() {
        const body = newNoteBody.trim();

        if (!canCreate || isSaving) {
            return;
        }

        if (!body) {
            setErrorMessage(
                "Escreva a nota antes de salvar.",
            );
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const response = await fetch(
                "/api/models/notes",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        modelId,
                        body,
                        priority:
                            newNotePriority,
                    }),
                },
            );

            const result =
                (await response.json()) as {
                    note?: unknown;
                    error?: string;
                };

            if (!response.ok) {
                throw new Error(
                    result.error ??
                        "Não foi possível adicionar a nota.",
                );
            }

            setNewNoteBody("");
            setNewNotePriority("normal");

            await loadNotes();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido ao adicionar a nota.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    function beginEditing(note: ModelNote) {
        if (!canEdit) {
            return;
        }

        setEditingNote(note);
        setEditingBody(note.body);
        setEditingPriority(note.priority);
        setErrorMessage(null);
    }

    function cancelEditing() {
        if (isSaving) {
            return;
        }

        setEditingNote(null);
        setEditingBody("");
        setEditingPriority("normal");
    }

    async function confirmEdit() {
        if (
            !editingNote ||
            !canEdit ||
            isSaving
        ) {
            return;
        }

        const body = editingBody.trim();

        if (!body) {
            setErrorMessage(
                "A nota não pode ficar vazia.",
            );
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const response = await fetch(
                "/api/models/notes",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        modelId,
                        noteId: editingNote.id,
                        action: "edit",
                        body,
                        priority:
                            editingPriority,
                    }),
                },
            );

            const result =
                (await response.json()) as {
                    error?: string;
                };

            if (!response.ok) {
                throw new Error(
                    result.error ??
                        "Não foi possível editar a nota.",
                );
            }

            setEditingNote(null);
            setEditingBody("");
            setEditingPriority("normal");

            await loadNotes();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido ao editar a nota.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function togglePinned(
        note: ModelNote,
    ) {
        if (!canPin || actionNoteId) {
            return;
        }

        setActionNoteId(note.id);
        setErrorMessage(null);

        try {
            const response = await fetch(
                "/api/models/notes",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        modelId,
                        noteId: note.id,
                        action: "pin",
                        pinned: !note.pinned,
                    }),
                },
            );

            const result =
                (await response.json()) as {
                    error?: string;
                };

            if (!response.ok) {
                throw new Error(
                    result.error ??
                        "Não foi possível alterar a fixação da nota.",
                );
            }

            await loadNotes();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido ao atualizar a nota.",
            );
        } finally {
            setActionNoteId(null);
        }
    }

    async function toggleArchived(
        note: ModelNote,
    ) {
        if (!canArchive || actionNoteId) {
            return;
        }

        const actionLabel = note.archived
            ? "restaurar"
            : "arquivar";

        const confirmed = window.confirm(
            `Tem certeza de que deseja ${actionLabel} esta nota?`,
        );

        if (!confirmed) {
            return;
        }

        setActionNoteId(note.id);
        setErrorMessage(null);

        try {
            const response = await fetch(
                "/api/models/notes",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        modelId,
                        noteId: note.id,
                        action: "archive",
                        archived:
                            !note.archived,
                    }),
                },
            );

            const result =
                (await response.json()) as {
                    error?: string;
                };

            if (!response.ok) {
                throw new Error(
                    result.error ??
                        "Não foi possível alterar o arquivamento da nota.",
                );
            }

            await loadNotes();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido ao atualizar a nota.",
            );
        } finally {
            setActionNoteId(null);
        }
    }

    if (isLoading) {
        return (
            <LoadingSection
                historyOnly={historyOnly}
            />
        );
    }

    if (historyOnly) {
        return (
            <HistoryPanel
                history={recentHistory}
                errorMessage={errorMessage}
                fullWidth
            />
        );
    }

    return (
        <>
            {errorMessage && (
                <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
                    {errorMessage}
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.8fr)]">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
                                Observações internas
                            </p>

                            <h2 className="mt-2 text-2xl font-bold">
                                Notas
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                                Registre informações importantes
                                sobre a modelo e acompanhe todas
                                as alterações.
                            </p>
                        </div>

                        <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(event) =>
                                    setShowArchived(
                                        event.target
                                            .checked,
                                    )
                                }
                                className="h-4 w-4 accent-pink-500"
                            />

                            Mostrar arquivadas
                        </label>
                    </div>

                    {canCreate ? (
                        <div className="mt-6 rounded-2xl border border-pink-400/20 bg-pink-500/5 p-4 sm:p-5">
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                                    Nova nota
                                </span>

                                <textarea
                                    value={newNoteBody}
                                    onChange={(
                                        event,
                                    ) =>
                                        setNewNoteBody(
                                            event.target
                                                .value,
                                        )
                                    }
                                    rows={5}
                                    maxLength={5000}
                                    placeholder="Escreva uma observação interna sobre esta modelo..."
                                    className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-pink-400/60"
                                />
                            </label>

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <label className="block">
                                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                                        Prioridade
                                    </span>

                                    <select
                                        value={
                                            newNotePriority
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setNewNotePriority(
                                                event
                                                    .target
                                                    .value as NotePriority,
                                            )
                                        }
                                        className="mt-2 w-full min-w-[180px] rounded-xl border border-white/10 bg-[#111115] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
                                    >
                                        {priorityOptions.map(
                                            (
                                                option,
                                            ) => (
                                                <option
                                                    key={
                                                        option.value
                                                    }
                                                    value={
                                                        option.value
                                                    }
                                                >
                                                    {
                                                        option.label
                                                    }
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>

                                <button
                                    type="button"
                                    onClick={() =>
                                        void createNote()
                                    }
                                    disabled={
                                        isSaving ||
                                        !newNoteBody.trim()
                                    }
                                    className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isSaving
                                        ? "Salvando..."
                                        : "Adicionar nota"}
                                </button>
                            </div>

                            <p className="mt-3 text-right text-xs text-white/35">
                                {newNoteBody.length} /
                                5000
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/50">
                            Seu nível de acesso permite
                            visualizar as notas, mas não
                            adicionar novas observações.
                        </div>
                    )}

                    <div className="mt-6 space-y-4">
                        {visibleNotes.length === 0 ? (
                            <EmptyNotes
                                showArchived={
                                    showArchived
                                }
                            />
                        ) : (
                            visibleNotes.map(
                                (note) => (
                                    <NoteCard
                                        key={note.id}
                                        note={note}
                                        canEdit={
                                            canEdit
                                        }
                                        canPin={
                                            canPin
                                        }
                                        canArchive={
                                            canArchive
                                        }
                                        isActing={
                                            actionNoteId ===
                                            note.id
                                        }
                                        onEdit={() =>
                                            beginEditing(
                                                note,
                                            )
                                        }
                                        onTogglePin={() =>
                                            void togglePinned(
                                                note,
                                            )
                                        }
                                        onToggleArchive={() =>
                                            void toggleArchived(
                                                note,
                                            )
                                        }
                                    />
                                ),
                            )
                        )}
                    </div>
                </section>

                <HistoryPanel
                    history={recentHistory}
                    errorMessage={null}
                />
            </div>

            {editingNote && (
                <EditConfirmationModal
                    note={editingNote}
                    body={editingBody}
                    priority={
                        editingPriority
                    }
                    isSaving={isSaving}
                    onBodyChange={
                        setEditingBody
                    }
                    onPriorityChange={
                        setEditingPriority
                    }
                    onCancel={
                        cancelEditing
                    }
                    onConfirm={() =>
                        void confirmEdit()
                    }
                />
            )}
        </>
    );
}

function NoteCard({
    note,
    canEdit,
    canPin,
    canArchive,
    isActing,
    onEdit,
    onTogglePin,
    onToggleArchive,
}: {
    note: ModelNote;
    canEdit: boolean;
    canPin: boolean;
    canArchive: boolean;
    isActing: boolean;
    onEdit: () => void;
    onTogglePin: () => void;
    onToggleArchive: () => void;
}) {
    const priority =
        priorityConfig(note.priority);

    return (
        <article
            className={`rounded-2xl border p-5 transition ${
                note.archived
                    ? "border-white/10 bg-white/[0.025] opacity-60"
                    : note.pinned
                      ? "border-pink-400/35 bg-pink-500/[0.08]"
                      : "border-white/10 bg-[#111115]"
            }`}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {note.pinned && (
                        <span className="rounded-full border border-pink-400/30 bg-pink-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-pink-200">
                            Fixada
                        </span>
                    )}

                    {note.archived && (
                        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                            Arquivada
                        </span>
                    )}

                    <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${priority.className}`}
                    >
                        {priority.label}
                    </span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canPin && (
                        <ActionButton
                            disabled={isActing}
                            onClick={onTogglePin}
                        >
                            {note.pinned
                                ? "Desafixar"
                                : "Fixar"}
                        </ActionButton>
                    )}

                    {canEdit &&
                        !note.archived && (
                            <ActionButton
                                disabled={
                                    isActing
                                }
                                onClick={
                                    onEdit
                                }
                            >
                                Editar
                            </ActionButton>
                        )}

                    {canArchive && (
                        <ActionButton
                            disabled={isActing}
                            onClick={
                                onToggleArchive
                            }
                        >
                            {note.archived
                                ? "Restaurar"
                                : "Arquivar"}
                        </ActionButton>
                    )}
                </div>
            </div>

            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-white/85">
                {note.body}
            </p>

            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/40">
                <p>
                    Criada por{" "}
                    <span className="font-semibold text-white/65">
                        {note.createdByName}
                    </span>{" "}
                    ·{" "}
                    {roleLabel(
                        note.createdByRole,
                    )}{" "}
                    ·{" "}
                    {formatDateTime(
                        note.createdAt,
                    )}
                </p>

                {note.updatedAt !==
                    note.createdAt && (
                    <p className="mt-1">
                        Última edição por{" "}
                        <span className="font-semibold text-white/65">
                            {note.updatedByName ??
                                note.createdByName}
                        </span>{" "}
                        ·{" "}
                        {formatDateTime(
                            note.updatedAt,
                        )}
                    </p>
                )}
            </div>
        </article>
    );
}

function HistoryPanel({
    history,
    errorMessage,
    fullWidth = false,
}: {
    history: NoteHistory[];
    errorMessage: string | null;
    fullWidth?: boolean;
}) {
    return (
        <section
            className={`rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6 ${
                fullWidth
                    ? "w-full"
                    : ""
            }`}
        >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
                Registro permanente
            </p>

            <h2 className="mt-2 text-2xl font-bold">
                {fullWidth
                    ? "Histórico completo"
                    : "Histórico recente"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/50">
                Alterações realizadas nas notas,
                com responsável, data e conteúdo
                anterior.
            </p>

            {errorMessage && (
                <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                </div>
            )}

            <div className="mt-6 space-y-4">
                {history.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-center">
                        <p className="text-sm font-semibold text-white/60">
                            Nenhuma alteração
                            registrada.
                        </p>

                        <p className="mt-2 text-xs text-white/35">
                            As ações realizadas nas
                            notas aparecerão aqui.
                        </p>
                    </div>
                ) : (
                    history.map((item) => (
                        <HistoryCard
                            key={item.id}
                            item={item}
                        />
                    ))
                )}
            </div>
        </section>
    );
}

function HistoryCard({
    item,
}: {
    item: NoteHistory;
}) {
    return (
        <article className="rounded-2xl border border-white/10 bg-[#111115] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-pink-200">
                    {historyActionLabel(
                        item.action,
                    )}
                </span>

                <span className="text-xs text-white/35">
                    {formatDateTime(
                        item.createdAt,
                    )}
                </span>
            </div>

            <p className="mt-3 text-xs text-white/45">
                Por{" "}
                <span className="font-semibold text-white/70">
                    {item.editorName}
                </span>{" "}
                ·{" "}
                {roleLabel(
                    item.editorRole,
                )}
            </p>

            {item.originalBody &&
                item.updatedBody &&
                item.originalBody !==
                    item.updatedBody && (
                    <div className="mt-4 space-y-3">
                        <HistoryText
                            label="Versão anterior"
                            text={
                                item.originalBody
                            }
                            muted
                        />

                        <HistoryText
                            label="Nova versão"
                            text={
                                item.updatedBody
                            }
                        />
                    </div>
                )}

            {!item.originalBody &&
                item.updatedBody && (
                    <HistoryText
                        label="Conteúdo"
                        text={item.updatedBody}
                    />
                )}

            {item.originalBody &&
                !item.updatedBody && (
                    <HistoryText
                        label="Conteúdo registrado"
                        text={item.originalBody}
                        muted
                    />
                )}
        </article>
    );
}

function HistoryText({
    label,
    text,
    muted = false,
}: {
    label: string;
    text: string;
    muted?: boolean;
}) {
    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                {label}
            </p>

            <p
                className={`mt-2 whitespace-pre-wrap break-words text-xs leading-5 ${
                    muted
                        ? "text-white/40 line-through decoration-white/20"
                        : "text-white/70"
                }`}
            >
                {text}
            </p>
        </div>
    );
}

function EditConfirmationModal({
    note,
    body,
    priority,
    isSaving,
    onBodyChange,
    onPriorityChange,
    onCancel,
    onConfirm,
}: {
    note: ModelNote;
    body: string;
    priority: NotePriority;
    isSaving: boolean;
    onBodyChange: (value: string) => void;
    onPriorityChange: (
        value: NotePriority,
    ) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-pink-400/30 bg-[#111115] p-5 shadow-2xl sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
                    Confirmação obrigatória
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                    Editar esta nota?
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/55">
                    A versão anterior será mantida
                    permanentemente no histórico
                    junto com seu nome, função, data
                    e horário.
                </p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">
                        Versão atual
                    </p>

                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/55">
                        {note.body}
                    </p>
                </div>

                <label className="mt-5 block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                        Nova versão
                    </span>

                    <textarea
                        value={body}
                        onChange={(event) =>
                            onBodyChange(
                                event.target.value,
                            )
                        }
                        rows={7}
                        maxLength={5000}
                        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-pink-400/60"
                    />
                </label>

                <label className="mt-4 block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                        Prioridade
                    </span>

                    <select
                        value={priority}
                        onChange={(event) =>
                            onPriorityChange(
                                event.target
                                    .value as NotePriority,
                            )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
                    >
                        {priorityOptions.map(
                            (option) => (
                                <option
                                    key={
                                        option.value
                                    }
                                    value={
                                        option.value
                                    }
                                >
                                    {
                                        option.label
                                    }
                                </option>
                            ),
                        )}
                    </select>
                </label>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSaving}
                        className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={
                            isSaving ||
                            !body.trim()
                        }
                        className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isSaving
                            ? "Salvando..."
                            : "Confirmar edição"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ActionButton({
    children,
    disabled,
    onClick,
}: {
    children: React.ReactNode;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-pink-400/30 hover:bg-pink-500/10 hover:text-pink-200 disabled:cursor-not-allowed disabled:opacity-35"
        >
            {children}
        </button>
    );
}

function EmptyNotes({
    showArchived,
}: {
    showArchived: boolean;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-5 py-12 text-center">
            <p className="text-base font-bold text-white/65">
                {showArchived
                    ? "Nenhuma nota encontrada"
                    : "Nenhuma nota ativa"}
            </p>

            <p className="mt-2 text-sm text-white/35">
                {showArchived
                    ? "Ainda não existem notas para esta modelo."
                    : "Adicione uma observação usando o formulário acima."}
            </p>
        </div>
    );
}

function LoadingSection({
    historyOnly,
}: {
    historyOnly: boolean;
}) {
    return (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-8">
            <div className="animate-pulse">
                <div className="h-3 w-36 rounded bg-white/10" />
                <div className="mt-4 h-8 w-56 rounded bg-white/10" />

                <div
                    className={`mt-8 grid gap-5 ${
                        historyOnly
                            ? ""
                            : "xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.8fr)]"
                    }`}
                >
                    <div className="h-80 rounded-2xl bg-white/5" />

                    {!historyOnly && (
                        <div className="h-80 rounded-2xl bg-white/5" />
                    )}
                </div>
            </div>
        </section>
    );
}

function normalizeNote(
    value: unknown,
): ModelNote | null {
    if (!isRecord(value)) {
        return null;
    }

    const id = readString(
        value.id,
    );

    const body = readString(
        value.body,
        value.content,
        value.note,
    );

    if (!id || !body) {
        return null;
    }

    return {
        id,
        modelId:
            readString(
                value.modelId,
                value.model_id,
            ) ?? "",
        body,
        priority: normalizePriority(
            readString(value.priority),
        ),
        pinned: readBoolean(
            value.pinned,
            value.is_pinned,
        ),
        archived: readBoolean(
            value.archived,
            value.is_archived,
        ),
        createdByName:
            readString(
                value.createdByName,
                value.created_by_name,
                value.authorName,
                value.author_name,
            ) ?? "Usuário",
        createdByRole:
            readString(
                value.createdByRole,
                value.created_by_role,
                value.authorRole,
                value.author_role,
            ) ?? "administrator",
        updatedByName:
            readString(
                value.updatedByName,
                value.updated_by_name,
            ),
        updatedByRole:
            readString(
                value.updatedByRole,
                value.updated_by_role,
            ),
        createdAt:
            readString(
                value.createdAt,
                value.created_at,
            ) ??
            new Date().toISOString(),
        updatedAt:
            readString(
                value.updatedAt,
                value.updated_at,
            ) ??
            readString(
                value.createdAt,
                value.created_at,
            ) ??
            new Date().toISOString(),
    };
}

function normalizeHistory(
    value: unknown,
): NoteHistory | null {
    if (!isRecord(value)) {
        return null;
    }

    const id = readString(
        value.id,
    );

    if (!id) {
        return null;
    }

    return {
        id,
        noteId: readString(
            value.noteId,
            value.note_id,
        ),
        action:
            readString(
                value.action,
                value.changeType,
                value.change_type,
            ) ?? "updated",
        originalBody: readString(
            value.originalBody,
            value.original_body,
            value.oldBody,
            value.old_body,
            value.previousBody,
            value.previous_body,
        ),
        updatedBody: readString(
            value.updatedBody,
            value.updated_body,
            value.newBody,
            value.new_body,
            value.body,
        ),
        editorName:
            readString(
                value.editorName,
                value.editor_name,
                value.createdByName,
                value.created_by_name,
            ) ?? "Usuário",
        editorRole:
            readString(
                value.editorRole,
                value.editor_role,
                value.createdByRole,
                value.created_by_role,
            ) ?? "administrator",
        createdAt:
            readString(
                value.createdAt,
                value.created_at,
            ) ??
            new Date().toISOString(),
    };
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function readString(
    ...values: unknown[]
): string | null {
    for (const value of values) {
        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return value;
        }
    }

    return null;
}

function readBoolean(
    ...values: unknown[]
): boolean {
    for (const value of values) {
        if (typeof value === "boolean") {
            return value;
        }

        if (value === 1 || value === "1") {
            return true;
        }

        if (value === 0 || value === "0") {
            return false;
        }
    }

    return false;
}

function normalizePriority(
    value: string | null,
): NotePriority {
    if (
        value === "important" ||
        value === "urgent"
    ) {
        return value;
    }

    return "normal";
}

function priorityConfig(
    priority: NotePriority,
) {
    const configs: Record<
        NotePriority,
        {
            label: string;
            className: string;
        }
    > = {
        normal: {
            label: "Normal",
            className:
                "border-white/15 bg-white/5 text-white/50",
        },
        important: {
            label: "Importante",
            className:
                "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
        },
        urgent: {
            label: "Urgente",
            className:
                "border-red-400/30 bg-red-500/10 text-red-200",
        },
    };

    return configs[priority];
}

function historyActionLabel(
    action: string,
) {
    const normalized =
        action.toLowerCase();

    const labels: Record<
        string,
        string
    > = {
        created: "Nota criada",
        create: "Nota criada",
        edited: "Nota editada",
        edit: "Nota editada",
        updated: "Nota atualizada",
        update: "Nota atualizada",
        pinned: "Nota fixada",
        pin: "Fixação alterada",
        unpinned: "Nota desafixada",
        archived: "Nota arquivada",
        archive: "Arquivamento alterado",
        restored: "Nota restaurada",
        restore: "Nota restaurada",
    };

    return (
        labels[normalized] ??
        "Alteração registrada"
    );
}

function roleLabel(
    role: string,
) {
    const labels: Record<
        string,
        string
    > = {
        owner: "Proprietário",
        administrator: "Administrador",
        representative: "Representante",
        model: "Modelo",
    };

    return labels[role] ?? role;
}

function formatDateTime(
    value: string,
) {
    const date = new Date(value);

    if (
        Number.isNaN(date.getTime())
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        },
    ).format(date);
}