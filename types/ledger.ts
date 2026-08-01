// Expenses (transporte / hotel) and loans (empréstimo) recorded against a
// model. Shared by the admin panel and the read-only model portal sections.

export type LedgerEntryType = "transporte" | "hotel" | "emprestimo";

export type LedgerProvider = "uber" | "99" | "indrive";

export type LedgerStatusKind = "pendente" | "agendado" | "descontado";

export interface LedgerEntryStatus {
  kind: LedgerStatusKind;
  /** `Pendente`, `Agendado para 05/09/2026`, `Descontado em SETEMBRO/2026`. */
  label: string;
}

export interface LedgerEntry {
  id: string;
  modelId: string;
  entryType: LedgerEntryType;
  provider: LedgerProvider | null;
  hotelName: string | null;
  amountBrl: number;
  /** When the cost happened. Record only — never affects a payout. */
  incurredOn: string;
  /** The month this date falls in is the month the deduction hits. */
  deductOn: string | null;
  /** BRL per 1 USD, frozen on the day `deductOn` was reached. */
  deductionFxRate: number | null;
  deductionAmountUsd: number | null;
  deductedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: LedgerEntryStatus;
}

/** A deduction as shown on the earnings card's itemised breakdown. */
export interface LedgerDeduction {
  id: string;
  label: string;
  amountBrl: number;
  amountUsd: number;
  deductOn: string;
}
