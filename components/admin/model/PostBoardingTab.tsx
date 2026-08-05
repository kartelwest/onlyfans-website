"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { toLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/models/formatDateTime";

import type { ManagementRole } from "@/types/model";

type Note = {
  id: string;
  modelId: string;
  itemKey: string;
  sectionKey: string;
  itemTitle: string;
  itemDescription: string | null;
  body: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByRole: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedByRole: string | null;
  createdAt: string;
  updatedAt: string;
};

type Item = {
  key: string;
  title: string;
  description: string;
  notes: Note[];
};

type Section = {
  key: string;
  title: string;
  items: Item[];
};

type PostBoardingResponse = {
  sections?: Section[];
  canEdit?: boolean;
  error?: string;
};

export default function PostBoardingTab({
  modelId,
  currentUserRole,
}: {
  modelId: string;
  currentUserRole: ManagementRole;
}) {
  const t = useTranslations("admin.postBoarding");
  const locale = toLocale(useLocale());

  const [sections, setSections] = useState<Section[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newNotes, setNewNotes] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

  const fetchPostBoarding = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(
        `/api/models/post-boarding?modelId=${encodeURIComponent(modelId)}`,
        { cache: "no-store" },
      );

      const result = (await response.json()) as PostBoardingResponse;

      if (!response.ok) {
        throw new Error(result.error ?? t("loadFailed"));
      }

      setSections(result.sections ?? []);
      setCanEdit(result.canEdit ?? false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [modelId, t]);

  useEffect(() => {
    fetchPostBoarding();
  }, [fetchPostBoarding]);

  const handleCreate = async (itemKey: string) => {
    const body = newNotes[itemKey]?.trim() ?? "";

    if (!body) return;

    setSaveError(null);
    setIsSaving((prev) => ({ ...prev, [itemKey]: true }));

    try {
      const response = await fetch("/api/models/post-boarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, itemKey, body }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };

        throw new Error(result.error ?? t("saveFailed"));
      }

      setNewNotes((prev) => ({ ...prev, [itemKey]: "" }));
      await fetchPostBoarding();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setIsSaving((prev) => ({ ...prev, [itemKey]: false }));
    }
  };

  const startEdit = (note: Note) => {
    setEditing((prev) => ({ ...prev, [note.id]: note.body }));
  };

  const cancelEdit = (noteId: string) => {
    setEditing((prev) => {
      const next = { ...prev };

      delete next[noteId];

      return next;
    });
  };

  const handleUpdate = async (noteId: string) => {
    const body = editing[noteId]?.trim() ?? "";

    if (!body) return;

    setSaveError(null);
    setIsSaving((prev) => ({ ...prev, [noteId]: true }));

    try {
      const response = await fetch("/api/models/post-boarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, noteId, body }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };

        throw new Error(result.error ?? t("saveFailed"));
      }

      cancelEdit(noteId);
      await fetchPostBoarding();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setIsSaving((prev) => ({ ...prev, [noteId]: false }));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-white/50">{t("loading")}</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-300">{loadError}</p>;
  }

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {saveError}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.key}>
          <h2 className="text-xl font-bold text-white">{section.title}</h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {section.items.map((item) => (
              <article
                key={item.key}
                className="rounded-2xl border border-white/10 bg-[#161219] p-5"
              >
                <h3 className="font-semibold text-white">{item.title}</h3>

                {item.description && (
                  <p className="mt-1 text-sm text-white/55">
                    {item.description}
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  {item.notes.length === 0 ? (
                    <p className="text-sm text-white/35">{t("emptyNotes")}</p>
                  ) : (
                    item.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-xl border border-white/5 bg-black/20 p-3"
                      >
                        {editing[note.id] !== undefined ? (
                          <div className="space-y-2">
                            <textarea
                              value={editing[note.id]}
                              onChange={(event) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [note.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:border-pink-400 focus:outline-none"
                              rows={3}
                            />

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate(note.id)}
                                disabled={isSaving[note.id]}
                                className="rounded-lg bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-pink-400 disabled:opacity-50"
                              >
                                {t("save")}
                              </button>

                              <button
                                onClick={() => cancelEdit(note.id)}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/5"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap text-sm text-white/80">
                              {note.body}
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-white/40">
                              <span>
                                {formatDateTime(
                                  new Date(note.createdAt),
                                  locale as Locale,
                                )}{" "}
                                — {note.createdByName ?? t("unknownUser")}
                                {note.createdByRole &&
                                  currentUserRole !== "model" && (
                                    <>
                                      {" "}
                                      ({note.createdByRole})
                                    </>
                                  )}
                              </span>

                              {canEdit && (
                                <button
                                  onClick={() => startEdit(note)}
                                  className="text-pink-300 transition hover:text-pink-200"
                                >
                                  {t("edit")}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {canEdit && (
                  <div className="mt-4 space-y-2">
                    <textarea
                      value={newNotes[item.key] ?? ""}
                      onChange={(event) =>
                        setNewNotes((prev) => ({
                          ...prev,
                          [item.key]: event.target.value,
                        }))
                      }
                      placeholder={t("placeholder")}
                      className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:border-pink-400 focus:outline-none"
                      rows={3}
                    />

                    <button
                      onClick={() => handleCreate(item.key)}
                      disabled={
                        !newNotes[item.key]?.trim() || isSaving[item.key]
                      }
                      className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:opacity-50"
                    >
                      {t("addNote")}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
