"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { toLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime as formatLocalizedDateTime } from "@/lib/models/formatDateTime";
import {
  DAILY_NOTE_MAX_LENGTH,
  dailyBand,
  type DailyBand,
} from "@/lib/daily/definition";

import type { ManagementRole } from "@/types/model";

type ItemView = {
  id: string;
  itemKey: string;
  sectionKey: string;
  /** Resolves `daily.items.<sectionKey>.<key>` in the READER's catalogue. */
  key: string;
  completed: boolean;
  completedAt: string | null;
  notes: string;
};

type SectionView = {
  key: string;
  order: number;
  items: ItemView[];
  completed: number;
  total: number;
  percentage: number;
};

type Summary = {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  withNotes: number;
};

type DailyResponse = {
  sections?: SectionView[];
  summary?: Summary;
  canEdit?: boolean;
  error?: string;
};

type Filter = "all" | "pending" | "done" | "notes";

const EMPTY_SUMMARY: Summary = {
  total: 0,
  completed: 0,
  remaining: 0,
  percentage: 0,
  withNotes: 0,
};

/** The id doubles as the key under `admin.dailyPanel.filters`. */
const FILTERS: { id: Filter }[] = [
  { id: "all" },
  { id: "pending" },
  { id: "done" },
  { id: "notes" },
];

/**
 * The three bands, in colour. `dailyBand` owns where the thresholds fall — this
 * only decides what each one looks like, and the admin list paints the same
 * band with the same palette.
 */
const BAND_STYLES: Record<
  DailyBand,
  { bar: string; badge: string; text: string }
> = {
  red: {
    bar: "bg-red-500",
    badge: "border-red-400/40 bg-red-500/15 text-red-200",
    text: "text-red-300",
  },
  yellow: {
    bar: "bg-yellow-400",
    badge: "border-yellow-400/40 bg-yellow-500/15 text-yellow-200",
    text: "text-yellow-300",
  },
  green: {
    bar: "bg-emerald-500",
    badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    text: "text-emerald-300",
  },
};

async function fetchDaily(modelId: string): Promise<DailyResponse> {
  const response = await fetch(
    `/api/models/daily?modelId=${encodeURIComponent(modelId)}`,
    { method: "GET", cache: "no-store" },
  );

  const result = (await response.json()) as DailyResponse;

  if (!response.ok) {
    // The route's own message is already in the reader's language. When it did
    // not send one, the message is left empty on purpose: the caller fills it
    // from the catalogue, because this function has no translator.
    throw new Error(result.error ?? "");
  }

  return result;
}

export default function DailyTab({
  modelId,
}: {
  modelId: string;
  currentUserRole?: ManagementRole;
}) {
  const t = useTranslations("admin.dailyPanel");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");
  // The checklist's own words. Read here rather than on the server so they
  // always match the language the rest of this page is already in.
  const tDaily = useTranslations("daily");

  const [sections, setSections] = useState<SectionView[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [canEdit, setCanEdit] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // Every block starts collapsed. Sixty-eight steps opened at once is a wall of
  // text; closed, the tab opens on eleven headings and their percentages, and
  // you open the one you are working through.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const applyResponse = useCallback((result: DailyResponse) => {
    setSections(result.sections ?? []);
    setSummary(result.summary ?? EMPTY_SUMMARY);
    setCanEdit(result.canEdit === true);
  }, []);

  // The fetch is kicked off in the effect but every setState happens in a
  // callback once it resolves, never synchronously in the effect body — the
  // one shape react-hooks/set-state-in-effect accepts, and the one that lets a
  // model switch mid-flight without the stale response landing.
  useEffect(() => {
    let active = true;

    fetchDaily(modelId)
      .then((result) => {
        if (!active) return;

        applyResponse(result);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setErrorMessage(
          (error instanceof Error && error.message) || t("loadFailed"),
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [modelId, applyResponse]);

  const patch = useCallback(
    async (key: string, payload: Record<string, unknown>): Promise<boolean> => {
      setSavingKey(key);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/models/daily", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, ...payload }),
        });

        const result = (await response.json()) as DailyResponse;

        if (!response.ok) {
          throw new Error(result.error ?? tErrors("saveFailed"));
        }

        applyResponse(result);

        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : tErrors("saveFailed"),
        );

        return false;
      } finally {
        setSavingKey(null);
      }
    },
    [modelId, applyResponse],
  );

  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        visibleItems: section.items.filter((item) => {
          if (filter === "pending") return !item.completed;
          if (filter === "done") return item.completed;
          if (filter === "notes") return item.notes.trim() !== "";
          return true;
        }),
      }))
      .filter((section) => section.visibleItems.length > 0);
  }, [sections, filter]);

  const band = dailyBand(summary.percentage);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
        <p className="text-sm text-white/55">{t("loading")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              {t("eyebrow")}
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">{t("title")}</h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              {t("intro")}
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-4 xl:max-w-2xl">
            <SummaryCard
              label={t("progress")}
              value={`${summary.percentage}%`}
              className={BAND_STYLES[band].badge}
            />
            <SummaryCard label={t("total")} value={summary.total} />
            <SummaryCard label={t("completed")} value={summary.completed} />
            <SummaryCard label={t("withNotes")} value={summary.withNotes} />
          </div>
        </div>

        <div className="mt-6 h-4 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${BAND_STYLES[band].bar}`}
            style={{ width: `${summary.percentage}%` }}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/45">
            {t("stepsCompleted", {
              done: summary.completed,
              total: summary.total,
            })}
          </p>

          <p className={`text-xs font-bold ${BAND_STYLES[band].text}`}>
            {t(`bands.${band}`)}
          </p>
        </div>

        <p className="mt-3 text-xs text-white/35">{t("bandLegend")}</p>

        {!canEdit && (
          <p className="mt-3 text-xs font-semibold text-yellow-200">
            {t("readOnly")}
          </p>
        )}
      </header>

      {errorMessage && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              filter === option.id
                ? "border-pink-400 bg-pink-400 text-black"
                : "border-white/10 bg-black/20 text-white/55 hover:border-pink-400/40 hover:text-white"
            }`}
          >
            {option.id === "all" ? tState("all") : t(`filters.${option.id}`)}
          </button>
        ))}
      </div>

      {visibleSections.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
          <p className="text-sm text-white/55">{t("noMatches")}</p>
        </section>
      ) : (
        <div className="space-y-5">
          {visibleSections.map((section) => {
            const isOpen = openSections[section.key] === true;
            const sectionBand = dailyBand(section.percentage);

            return (
              <section
                key={section.key}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections((current) => ({
                      ...current,
                      [section.key]: !current[section.key],
                    }))
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left transition hover:bg-white/[0.03] sm:px-6"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-300">
                      {t("block", { order: section.order })}
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-white">
                      {tDaily(`sections.${section.key}.title`)}
                    </h3>

                    <p className="mt-1 text-sm text-white/45">
                      {t("sectionProgress", {
                        done: section.completed,
                        total: section.total,
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${BAND_STYLES[sectionBand].badge}`}
                    >
                      {section.percentage}%
                    </span>

                    <span className="text-xl text-white/50">
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10">
                    {section.visibleItems.map((item) => (
                      <ItemRow
                        key={item.itemKey}
                        item={item}
                        title={tDaily(
                          `items.${item.sectionKey}.${item.key}.title`,
                        )}
                        description={tDaily(
                          `items.${item.sectionKey}.${item.key}.description`,
                        )}
                        canEdit={canEdit}
                        isToggling={savingKey === item.itemKey}
                        isSavingNote={savingKey === `${item.itemKey}.notes`}
                        onToggle={(completed) =>
                          patch(item.itemKey, {
                            itemKey: item.itemKey,
                            completed,
                          })
                        }
                        onSaveNote={(notes) =>
                          patch(`${item.itemKey}.notes`, {
                            itemKey: item.itemKey,
                            notes,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ItemRow({
  item,
  title,
  description,
  canEdit,
  isToggling,
  isSavingNote,
  onToggle,
  onSaveNote,
}: {
  item: ItemView;
  title: string;
  description: string;
  canEdit: boolean;
  isToggling: boolean;
  isSavingNote: boolean;
  onToggle: (completed: boolean) => Promise<boolean>;
  onSaveNote: (notes: string) => Promise<boolean>;
}) {
  const t = useTranslations("admin.dailyPanel");
  const locale = toLocale(useLocale());

  // Closed on every step, every time — including a step that already carries a
  // note. The list is meant to be scanned, not read: the button's colour says
  // a note is there, and it only opens when someone means to write or read one.
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <div
      className={`border-b border-white/10 px-5 py-5 last:border-b-0 sm:px-6 ${
        item.completed ? "bg-emerald-500/[0.04]" : ""
      }`}
    >
      <div className="flex gap-4">
        <button
          type="button"
          disabled={!canEdit || isToggling}
          onClick={() => void onToggle(!item.completed)}
          aria-label={item.completed ? t("markPending") : t("markComplete")}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-black transition ${
            item.completed
              ? "border-emerald-400 bg-emerald-400 text-black"
              : "border-white/25 bg-white/5 text-transparent hover:border-pink-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isToggling ? "…" : item.completed ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4
                className={`text-sm font-bold ${
                  item.completed ? "text-emerald-200" : "text-white"
                }`}
              >
                {title}
              </h4>

              {description && (
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/45">
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setNoteOpen((open) => !open)}
              className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                item.notes.trim() !== ""
                  ? "border-blue-400/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
                  : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {noteOpen ? t("hideNote") : t("showNote")}

              <span className="text-xs">{noteOpen ? "−" : "+"}</span>
            </button>
          </div>

          {noteOpen && (
            <NoteBox
              value={item.notes}
              disabled={!canEdit}
              isSaving={isSavingNote}
              onSave={onSaveNote}
            />
          )}

          {item.completed && item.completedAt && (
            <p className="mt-3 text-xs font-semibold text-emerald-300/75">
              {t("completedOn", {
                when: formatDateTime(item.completedAt, locale),
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The optional note. Saves on blur and only when the text actually changed —
 * opening the box and closing it again must not manufacture history.
 */
function NoteBox({
  value,
  disabled,
  isSaving,
  onSave,
}: {
  value: string;
  disabled: boolean;
  isSaving: boolean;
  onSave: (notes: string) => Promise<boolean>;
}) {
  const t = useTranslations("admin.dailyPanel");

  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);

  // A save re-reads the whole checklist, so the stored note can change
  // underneath this box. Adjusting during render rather than in an effect is
  // React's documented way to follow a prop without a cascading render.
  const [serverValue, setServerValue] = useState(value);

  if (serverValue !== value) {
    setServerValue(value);
    setDraft(value);
  }

  async function commit() {
    const next = draft.trim();

    if (next === value.trim()) {
      return;
    }

    const ok = await onSave(next);

    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } else {
      setDraft(value);
    }
  }

  return (
    <label className="mt-4 block">
      <span className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
        {t("noteLabel")}

        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold normal-case tracking-normal text-white/45">
          {t("noteOptional")}
        </span>

        {isSaving && <span className="text-white/35">{t("saving")}</span>}

        {saved && !isSaving && (
          <span className="text-emerald-300">{t("saved")}</span>
        )}
      </span>

      <textarea
        value={draft}
        disabled={disabled || isSaving}
        rows={3}
        maxLength={DAILY_NOTE_MAX_LENGTH}
        placeholder={t("notePlaceholder")}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-400/60 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function SummaryCard({
  label,
  value,
  className = "border-white/10 bg-white/[0.03] text-pink-300",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function formatDateTime(value: string, locale: Locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatLocalizedDateTime(date, locale);
}
