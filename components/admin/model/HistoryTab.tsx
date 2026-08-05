"use client";

import { useLocale, useTranslations } from "next-intl";

import { toLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/models/formatDateTime";

import { useCallback, useEffect, useState } from "react";

import type { ManagementRole } from "@/types/model";

type AuditEntry = {
  id: string;
  modelId: string;
  action: string;
  fieldName: string | null;
  previousValue: string | null;
  newValue: string | null;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  source: string | null;
  summary: string;
  createdAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
};

type HistoryTabProps = {
  modelId: string;
  currentUserRole: ManagementRole;
};

/**
 * Audit action -> key under `admin.history.actions`. The action itself is a
 * database value and never changes; only how it reads does.
 */
const ACTION_KEYS: Record<string, string> = {
  field_update: "field_update",
  status_change: "status_change",
  proxy_update: "proxy_update",
  avatar_update: "avatar_update",
  checklist_update: "checklist_update",
  marketing_update: "marketing_update",
  onboarding_update: "onboarding_update",
  daily_update: "daily_update",
  daily_reset: "daily_reset",
  earnings_created: "earnings_created",
  document_uploaded: "document_uploaded",
  model_deleted: "model_deleted",
  model_created: "model_created",
  model_imported: "model_imported",
  model_applied: "model_applied",
  note_created: "note_created",
  note_edited: "note_edited",
  note_pinned: "note_pinned",
  note_unpinned: "note_unpinned",
  note_archived: "note_archived",
  note_restored: "note_restored",
  note_visibility_changed: "note_visibility_changed",
};

const ACTION_COLORS: Record<string, string> = {
  field_update: "text-blue-300",
  status_change: "text-yellow-300",
  proxy_update: "text-purple-300",
  note_visibility_changed: "text-pink-300",
  avatar_update: "text-green-300",
  checklist_update: "text-cyan-300",
  marketing_update: "text-indigo-300",
  onboarding_update: "text-teal-300",
  daily_update: "text-fuchsia-300",
  daily_reset: "text-fuchsia-400",
  earnings_created: "text-emerald-300",
  document_uploaded: "text-sky-300",
  model_deleted: "text-red-300",
  model_created: "text-green-300",
  model_imported: "text-orange-300",
  model_applied: "text-pink-300",
  note_created: "text-rose-300",
  note_edited: "text-rose-300",
  note_pinned: "text-rose-300",
  note_unpinned: "text-rose-300",
  note_archived: "text-rose-300",
  note_restored: "text-rose-300",
};

const ACTION_FILTERS = [
  "field_update",
  "status_change",
  "proxy_update",
  "avatar_update",
  "checklist_update",
  "marketing_update",
  "onboarding_update",
  "daily_update",
  "daily_reset",
  "earnings_created",
  "document_uploaded",
  "model_deleted",
  "model_created",
  "model_imported",
  "model_applied",
  "note_created",
  "note_edited",
  "note_pinned",
  "note_unpinned",
  "note_archived",
  "note_restored",
];

/**
 * An audit row's timestamp. Always São Paulo time, whatever zone the admin is
 * reading from — the history has to agree with itself across a team spread over
 * several countries — and always in the reader's field order.
 */
function formatAuditTimestamp(iso: string, locale: Locale): string {
  try {
    return formatDateTime(new Date(iso), locale);
  } catch {
    return iso;
  }
}



function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? "text-zinc-300";
}



export default function HistoryTab({
  modelId,
  currentUserRole,
}: HistoryTabProps) {
  const t = useTranslations("admin.history");
  const tRole = useTranslations("enums.role");
  const locale = toLocale(useLocale());

  /** Falls back to the raw action when the catalog has no entry for it. */
  const actionLabel = (action: string) =>
    ACTION_KEYS[action] ? t(`actions.${ACTION_KEYS[action]}`) : action;

  const roleLabel = (role: string) =>
    role === "owner" ||
    role === "administrator" ||
    role === "representative" ||
    role === "model"
      ? tRole(role)
      : role;

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        modelId,
        page: String(page),
        pageSize: "25",
      });

      if (actionFilter) {
        params.set("action", actionFilter);
      }

      const res = await fetch(`/api/models/history?${params.toString()}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("loadFailed"));
      }

      const data = await res.json();

      setEntries(data.entries ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [modelId, page, actionFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-pink-200">
            {t("title")}
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">{t("filter")}</label>
          <select
            value={actionFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-[#1a1a1e] px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400"
          >
            <option value="">{t("allActions")}</option>
            {ACTION_FILTERS.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-zinc-400">
          {t("loading")}
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-zinc-400">
          {t("empty")}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-white/10 bg-[#1a1a1e] p-4 transition hover:border-pink-400/30"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${getActionColor(entry.action)}`}
                      >
                        {actionLabel(entry.action)}
                      </span>
                      {entry.fieldName && (
                        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300">
                          {entry.fieldName}
                        </span>
                      )}
                    </div>

                    {/*
                      Printed exactly as it was recorded. An entry is a record
                      of something someone did, in the words they did it in —
                      re-rendering it in the reader's language would rewrite
                      history every time the switcher moved.
                    */}
                    <p className="mt-1 text-sm text-zinc-200">
                      {entry.summary}
                    </p>

                    {entry.previousValue !== null &&
                      entry.newValue !== null && (
                        <div className="mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:gap-3">
                          <span className="text-zinc-500">
                            {t("before")}{" "}
                            <span className="text-zinc-300">
                              {entry.previousValue}
                            </span>
                          </span>
                          <span className="text-zinc-500">
                            {t("after")}{" "}
                            <span className="text-zinc-300">
                              {entry.newValue}
                            </span>
                          </span>
                        </div>
                      )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>
                        {t("by")}{" "}
                        <span className="text-zinc-300">
                          {entry.actorName}
                        </span>{" "}
                        ({roleLabel(entry.actorRole)})
                      </span>
                      <span>·</span>
                      <span>
                        {formatAuditTimestamp(entry.createdAt, locale)}
                      </span>
                      {entry.source && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-zinc-600">
                            {entry.source}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition enabled:hover:border-pink-400 enabled:hover:text-pink-300 disabled:opacity-40"
              >
                {t("previous")}
              </button>

              <span className="text-sm text-zinc-400">
                {t("pagination", {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  count: pagination.totalCount,
                })}
              </span>

              <button
                type="button"
                disabled={!pagination.hasMore || loading}
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition enabled:hover:border-pink-400 enabled:hover:text-pink-300 disabled:opacity-40"
              >
                {t("next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
