import { formatDatePtBr, formatMonthYearPtBr } from "@/lib/earnings/period";

import type {
  LedgerDeduction,
  LedgerEntry,
  LedgerEntryStatus,
  LedgerEntryType,
  LedgerProvider,
} from "@/types/ledger";

export const LEDGER_ENTRY_TYPES: LedgerEntryType[] = [
  "transporte",
  "hotel",
  "emprestimo",
];

export const LEDGER_PROVIDERS: LedgerProvider[] = ["uber", "99", "indrive"];

export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  transporte: "Transporte",
  hotel: "Hotel",
  emprestimo: "Empréstimo",
};

export const LEDGER_PROVIDER_LABELS: Record<LedgerProvider, string> = {
  uber: "Uber",
  "99": "99",
  indrive: "inDrive",
};

export function isLedgerEntryType(value: unknown): value is LedgerEntryType {
  return (
    typeof value === "string" &&
    (LEDGER_ENTRY_TYPES as string[]).includes(value)
  );
}

export function isLedgerProvider(value: unknown): value is LedgerProvider {
  return (
    typeof value === "string" && (LEDGER_PROVIDERS as string[]).includes(value)
  );
}

/** `Transporte · Uber`, `Hotel · Ibis Centro`, `Empréstimo`. */
export function describeLedgerEntry(
  entry: Pick<LedgerEntry, "entryType" | "provider" | "hotelName">,
): string {
  if (entry.entryType === "transporte" && entry.provider) {
    return `${LEDGER_TYPE_LABELS.transporte} · ${LEDGER_PROVIDER_LABELS[entry.provider]}`;
  }

  if (entry.entryType === "hotel" && entry.hotelName) {
    return `${LEDGER_TYPE_LABELS.hotel} · ${entry.hotelName}`;
  }

  return LEDGER_TYPE_LABELS[entry.entryType];
}

export function ledgerEntryStatus(entry: {
  deductOn: string | null;
  deductedAt: string | null;
}): LedgerEntryStatus {
  if (!entry.deductOn) {
    return { kind: "pendente", label: "Pendente" };
  }

  if (entry.deductedAt) {
    return {
      kind: "descontado",
      label: `Descontado em ${formatMonthYearPtBr(entry.deductOn)}`,
    };
  }

  return {
    kind: "agendado",
    label: `Agendado para ${formatDatePtBr(entry.deductOn)}`,
  };
}

/**
 * The deductions that belong to one month: an entry counts against the month
 * its `deductOn` falls in, never the month the cost was incurred in, and only
 * once the snapshot has been taken. A pending entry (no `deductOn`) affects no
 * month at all.
 */
export function selectDeductionsForPeriod(
  entries: LedgerEntry[],
  periodMonth: string,
): LedgerDeduction[] {
  return entries
    .filter(
      (entry) =>
        entry.deductOn !== null &&
        entry.deductOn.slice(0, 7) === periodMonth.slice(0, 7) &&
        entry.deductedAt !== null &&
        entry.deductionAmountUsd !== null,
    )
    .map((entry) => ({
      id: entry.id,
      label: describeLedgerEntry(entry),
      amountBrl: entry.amountBrl,
      amountUsd: entry.deductionAmountUsd ?? 0,
      deductOn: entry.deductOn ?? "",
    }));
}

export type LedgerEntryRow = {
  id: string;
  model_id: string;
  entry_type: LedgerEntryType;
  provider: LedgerProvider | null;
  hotel_name: string | null;
  amount_brl: number | string;
  incurred_on: string;
  deduct_on: string | null;
  deduction_fx_rate: number | string | null;
  deduction_amount_usd: number | string | null;
  deducted_at: string | null;
  created_at: string;
  updated_at: string;
};

export const LEDGER_ENTRY_COLUMNS = `
  id,
  model_id,
  entry_type,
  provider,
  hotel_name,
  amount_brl,
  incurred_on,
  deduct_on,
  deduction_fx_rate,
  deduction_amount_usd,
  deducted_at,
  created_at,
  updated_at
`;

export function mapLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  const entry = {
    id: row.id,
    modelId: row.model_id,
    entryType: row.entry_type,
    provider: row.provider,
    hotelName: row.hotel_name,
    amountBrl: Number(row.amount_brl ?? 0),
    incurredOn: row.incurred_on,
    deductOn: row.deduct_on,
    deductionFxRate:
      row.deduction_fx_rate === null ? null : Number(row.deduction_fx_rate),
    deductionAmountUsd:
      row.deduction_amount_usd === null
        ? null
        : Number(row.deduction_amount_usd),
    deductedAt: row.deducted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return { ...entry, status: ledgerEntryStatus(entry) };
}
