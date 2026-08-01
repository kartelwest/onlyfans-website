"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDatePtBr } from "@/lib/earnings/period";
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_PROVIDERS,
  LEDGER_PROVIDER_LABELS,
  LEDGER_TYPE_LABELS,
} from "@/lib/ledger/entries";
import { BRL, USD, formatMoney } from "@/lib/money/currency";

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

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "agendado", label: "Agendados" },
  { value: "descontado", label: "Descontados" },
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
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

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
          data.error ?? "Não foi possível carregar os lançamentos.",
        );
      }

      setEntries(data.entries ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os lançamentos.",
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
        throw new Error(data.error ?? "Não foi possível salvar o lançamento.");
      }

      setSuccessMessage(
        editingId ? "Lançamento atualizado." : "Lançamento registrado.",
      );

      setForm(emptyForm);
      setEditingId(null);

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o lançamento.",
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
        data.error ?? "Não foi possível alterar a data de desconto.",
      );

      return;
    }

    await load();
  }

  async function deleteEntry(entry: LedgerEntry) {
    if (
      !window.confirm(
        "Excluir este lançamento? Ele sai da área da modelo, mas o registro e o histórico são mantidos.",
      )
    ) {
      return;
    }

    const response = await fetch(`/api/models/ledger/${entry.id}`, {
      method: "DELETE",
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErrorMessage(data.error ?? "Não foi possível excluir o lançamento.");
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
        <h3 className="text-xl font-bold">Lançamentos</h3>

        <p className="mt-1 text-sm text-white/45">
          Despesas e empréstimos em reais. A data em que o gasto ocorreu é só
          registro: o mês em que a data de desconto cai é o mês em que o valor
          sai dos ganhos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Tipo">
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
                {LEDGER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        {form.entryType === "transporte" && (
          <Field label="Aplicativo">
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
                  {LEDGER_PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
          </Field>
        )}

        {form.entryType === "hotel" && (
          <Field label="Nome do hotel">
            <input
              type="text"
              value={form.hotelName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hotelName: event.target.value,
                }))
              }
              placeholder="Ibis Centro"
              required
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
            />
          </Field>
        )}

        <Field label="Valor (R$)">
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
            placeholder="45,00"
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-pink-300"
          />
        </Field>

        <Field
          label={
            form.entryType === "emprestimo"
              ? "Data"
              : "Data em que ocorreu"
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

        <Field label="Data de desconto (opcional)">
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
            Em branco: fica pendente e não afeta nenhum mês.
          </p>
        </Field>

        <div className="flex items-center gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200 disabled:opacity-50"
          >
            {saving
              ? "Salvando..."
              : editingId
                ? "Salvar alterações"
                : "Registrar lançamento"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5"
            >
              Cancelar
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
          <option value="todos">Todos os tipos</option>

          {LEDGER_ENTRY_TYPES.map((type) => (
            <option key={type} value={type}>
              {LEDGER_TYPE_LABELS[type]}
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
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-white/45">Carregando...</p>
        ) : visibleEntries.length === 0 ? (
          <p className="text-sm text-white/45">Nenhum lançamento encontrado.</p>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                <th className="pb-3 pr-4 font-bold">Tipo</th>
                <th className="pb-3 pr-4 font-bold">Ocorrido em</th>
                <th className="pb-3 pr-4 font-bold">Valor</th>
                <th className="pb-3 pr-4 font-bold">Status</th>
                <th className="pb-3 pr-4 font-bold">Data de desconto</th>
                <th className="pb-3 font-bold">Ações</th>
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
                      {LEDGER_TYPE_LABELS[entry.entryType]}
                    </p>

                    <p className="text-xs text-white/45">
                      {entry.entryType === "transporte" && entry.provider
                        ? LEDGER_PROVIDER_LABELS[entry.provider]
                        : entry.hotelName || "—"}
                    </p>
                  </td>

                  <td className="py-3 pr-4 text-white/70">
                    {formatDatePtBr(entry.incurredOn)}
                  </td>

                  <td className="py-3 pr-4">
                    <p className="font-semibold">
                      {formatMoney(entry.amountBrl, BRL)}
                    </p>

                    {entry.deductionAmountUsd !== null && (
                      <p className="text-xs text-white/45">
                        {formatMoney(entry.deductionAmountUsd, USD, {
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
                      {entry.status.label}
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
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/5"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteEntry(entry)}
                        className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-500/10"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
