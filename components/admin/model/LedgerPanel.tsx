"use client";

import { useLocale, useTranslations } from "next-intl";

import { toLocale } from "@/lib/i18n/config";
import { useMoney } from "@/lib/i18n/money";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import { formatCalendarDate, formatMonthYear } from "@/lib/earnings/period";
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_PROVIDERS,
} from "@/lib/ledger/entries";
import { BRL, USD } from "@/lib/money/currency";

import type {
  LedgerEntry,
  LedgerEntryType,
  LedgerProvider,
  LedgerStatusKind,
} from "@/types/ledger";

type LedgerPanelProps = {
  modelId: string;
};

type StatusFilter = "todos" | LedgerStatusKind;
type TypeFilter = "todos" | LedgerEntryType;

/** Values are database statuses; words come from `enums.deductionStatus`. */
const STATUS_FILTERS: { value: StatusFilter }[] = [
  { value: "todos" },
  { value: "pendente" },
  { value: "agendado" },
  { value: "descontado" },
];

const STATUS_STYLES: Record<LedgerStatusKind, string> = {
  pendente: "border-white/15 bg-white/5 text-white/60",
  agendado: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
  descontado: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
};

const emptyForm = {
  entryType: "transporte" as LedgerEntryType,
  provider: "uber" as LedgerProvider,
  hotelName: "",
  amountBrl: "",
  incurredOn: "",
  deductOn: "",
};

export default function LedgerPanel({ modelId }: LedgerPanelProps) {
  const t = useTranslations("admin.ledger");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tType = useTranslations("enums.ledgerEntryType");
  const tProvider = useTranslations("enums.ledgerProvider");
  const tStatus = useTranslations("enums.deductionStatus");
  const money = useMoney();
  const locale = toLocale(useLocale());

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/models/ledger?modelId=${encodeURIComponent(modelId)}`,
      );

      const data = (await response.json()) as {
        entries?: LedgerEntry[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? t("loadFailed"),
        );
      }

      setEntries(data.entries ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (typeFilter !== "todos" && entry.entryType !== typeFilter) {
          return false;
        }

        if (statusFilter !== "todos" && entry.status.kind !== statusFilter) {
          return false;
        }

        return true;
      }),
    [entries, typeFilter, statusFilter],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      modelId,
      entryType: form.entryType,
      provider: form.entryType === "transporte" ? form.provider : null,
      hotelName: form.entryType === "hotel" ? form.hotelName : null,
      amountBrl: Number(form.amountBrl.replace(",", ".")),
      incurredOn: form.incurredOn,
      deductOn: form.deductOn || null,
    };

    try {
      const response = await fetch(
        editingId ? `/api/models/ledger/${editingId}` : "/api/models/ledger",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as {
        entry?: LedgerEntry;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? t("saveFailed"));
      }

      setSuccessMessage(
        editingId ? t("updated") : t("created"),
      );

      setForm(emptyForm);
      setEditingId(null);

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateDeductOn(entry: LedgerEntry, deductOn: string) {
    setErrorMessage(null);

    const response = await fetch(`/api/models/ledger/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_deduct_on",
        deductOn: deductOn || null,
      }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErrorMessage(
        data.error ?? t("deductDateFailed"),
      );

      return;
    }

    await load();
  }

  // Confirmed in the page, not through window.confirm — a mobile in-app
  // browser may suppress that dialog, and a suppressed confirm reads as
  // "cancelled", so the button looks dead.
  async function deleteEntry(entry: LedgerEntry) {
    setDeletingEntry(null);

    const response = await fetch(`/api/models/ledger/${entry.id}`, {
      method: "DELETE",
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErrorMessage(data.error ?? t("deleteFailed"));
      return;
    }

    await load();
  }

  function startEditing(entry: LedgerEntry) {
    setEditingId(entry.id);
    setSuccessMessage(null);
    setErrorMessage(null);

    setForm({
      entryType: entry.entryType,
      provider: entry.provider ?? "uber",
      hotelName: entry.hotelName ?? "",
      amountBrl: String(entry.amountBrl),
      incurredOn: entry.incurredOn,
      deductOn: entry.deductOn ?? "",
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
      <div>
        <h3 className="text-xl font-bold">{t("title")}</h3>

        <p className="mt-1 text-sm text-white/45">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label={t("type")}>
          <select
            value={form.entryType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                entryType: event.target.value as LedgerEntryType,
              }))
            }
            disabled={editingId !== null}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300 disabled:opacity-50"
          >
            {LEDGER_ENTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </select>
        </Field>

        {form.entryType === "transporte" && (
          <Field label={t("provider")}>
            <select
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  provider: event.target.value as LedgerProvider,
                }))
              }
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
            >
              {LEDGER_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {tProvider(provider)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {form.entryType === "hotel" && (
          <Field label={t("hotelName")}>
            <input
              type="text"
              value={form.hotelName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hotelName: event.target.value,
                }))
              }
              placeholder={t("hotelPlaceholder")}
              required
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
            />
          </Field>
        )}

        <Field label={t("amount")}>
          <input
            type="text"
            inputMode="decimal"
            value={form.amountBrl}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amountBrl: event.target.value,
              }))
            }
            placeholder={t("amountPlaceholder")}
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
          />
        </Field>

        <Field
          label={
            form.entryType === "emprestimo"
              ? t("date")
              : t("incurredOn")
          }
        >
          <input
            type="date"
            value={form.incurredOn}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                incurredOn: event.target.value,
              }))
            }
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
          />
        </Field>

        <Field label={t("deductOn")}>
          <input
            type="date"
            value={form.deductOn}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                deductOn: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
          />

          <p className="mt-1 text-[11px] text-white/35">
            {t("blankDateHint")}
          </p>
        </Field>

        <div className="flex items-center gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200 disabled:opacity-50"
          >
            {saving
              ? tCommon("saving")
              : editingId
                ? tCommon("save")
                : t("register")}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/5"
            >
              {tCommon("cancel")}
            </button>
          )}
        </div>
      </form>

      {errorMessage && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-xs font-semibold text-white/80"
        >
          <option value="todos">{t("allTypes")}</option>

          {LEDGER_ENTRY_TYPES.map((type) => (
            <option key={type} value={type}>
              {tType(type)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
          className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-xs font-semibold text-white/80"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.value === "todos"
                ? tState("all")
                : tStatus(filter.value)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-white/45">{tState("loading")}</p>
        ) : visibleEntries.length === 0 ? (
          <p className="text-sm text-white/45">{t("empty")}</p>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                <th className="pb-3 pr-4 font-bold">{t("type")}</th>
                <th className="pb-3 pr-4 font-bold">{t("incurredOn")}</th>
                <th className="pb-3 pr-4 font-bold">{t("amountShort")}</th>
                <th className="pb-3 pr-4 font-bold">{t("status")}</th>
                <th className="pb-3 pr-4 font-bold">{t("deductDate")}</th>
                <th className="pb-3 font-bold">{t("actions")}</th>
              </tr>
            </thead>

            <tbody>
              {visibleEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-white/5 align-top"
                >
                  <td className="py-3 pr-4">
                    <p className="font-semibold">
                      {tType(entry.entryType)}
                    </p>

                    <p className="text-xs text-white/45">
                      {entry.entryType === "transporte" && entry.provider
                        ? tProvider(entry.provider)
                        : entry.hotelName || "—"}
                    </p>
                  </td>

                  <td className="py-3 pr-4 text-white/70">
                    {formatCalendarDate(entry.incurredOn, locale)}
                  </td>

                  <td className="py-3 pr-4">
                    <p className="font-semibold">
                      {money.format(entry.amountBrl, BRL)}
                    </p>

                    {entry.deductionAmountUsd !== null && (
                      <p className="text-xs text-white/45">
                        {money.format(entry.deductionAmountUsd, USD, {
                          withCode: true,
                        })}
                      </p>
                    )}
                  </td>

                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        STATUS_STYLES[entry.status.kind]
                      }`}
                    >
                      {entry.status.kind === "descontado" && entry.deductOn
                        ? tStatus("deductedIn", {
                            month: formatMonthYear(entry.deductOn, locale),
                          })
                        : entry.status.kind === "agendado" && entry.deductOn
                          ? tStatus("scheduledFor", {
                              date: formatCalendarDate(entry.deductOn, locale),
                            })
                          : tStatus(entry.status.kind)}
                    </span>
                  </td>

                  <td className="py-3 pr-4">
                    <input
                      type="date"
                      defaultValue={entry.deductOn ?? ""}
                      onChange={(event) =>
                        void updateDeductOn(entry, event.target.value)
                      }
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-pink-300"
                    />
                  </td>

                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(entry)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/5"
                      >
                        {tCommon("edit")}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingEntry(entry)}
                        className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-500/10"
                      >
                        {tCommon("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deletingEntry !== null}
        title={t("deleteTitle")}
        description={
          <p>
            {t("deleteBody")}
          </p>
        }
        detail={
          deletingEntry
            ? `${tType(deletingEntry.entryType)} · ${money.format(
                deletingEntry.amountBrl,
                BRL,
              )} · ${formatCalendarDate(deletingEntry.incurredOn, locale)}`
            : null
        }
        confirmLabel={t("deleteConfirm")}
        busyLabel={tCommon("deleting")}
        onCancel={() => setDeletingEntry(null)}
        onConfirm={() => {
          if (deletingEntry) {
            void deleteEntry(deletingEntry);
          }
        }}
      />
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>

      <div className="mt-2">{children}</div>
    </label>
  );
}
