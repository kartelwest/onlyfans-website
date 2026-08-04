// Data contract for the rep/model-self "Model Dashboard" (KARAY Models).
// Deliberately separate from types/model.ts (the admin CRM's full Model
// type): this view only ever needs a small, fixed slice of fields, and
// keeping it separate means the two never drift into needing the same shape.

import type { LedgerDeduction, LedgerEntry } from "@/types/ledger";

export type ModelDashboardRole = "representative" | "model";

export interface ModelDashboardModel {
  id: string;
  stageName: string;
  fullName: string;
  active: boolean;
  profilePhotoUrl: string | null;

  birthday: string | null;
  location: string | null;
  email: string | null;
  whatsapp: string | null;
  /** ISO 4217 — the currency every amount on this dashboard is shown in. */
  currency: string;
  /** ISO 3166-1 alpha-2, drives the flag emoji. Null when not set. */
  countryCode: string | null;
  contentFrequency: string | null;
  blockBrazil: boolean;
  showFace: boolean;
  referralSource: string | null;

  /** The content folder she uploads into. Read-only to her. */
  contentDriveUrl: string | null;
  /** "Google Drive / Instagram" — a different folder, for a different purpose. */
  driveInstagramUrl: string | null;
}

export interface ModelDashboardChecklist {
  applicationApproved: boolean;
  onlyfansAccountCreated: boolean;
  socialAccountsConfigured: boolean;
  proxyBrowserReady: boolean;
  firstContentReceived: boolean;
  contractSigned: boolean;
}

export interface ModelDashboardFxRate {
  rate: number;
  rateDate: string;
  /** The live fetch failed and this is the last cached rate for the pair. */
  stale: boolean;
}

export interface ModelDashboardEarnings {
  /** `JULHO`, or `DEZEMBRO 2026` when the month is in a previous year. */
  periodTitle: string;
  /** `julho` — for the "Descontos de julho" line. */
  periodMonthName: string;
  /** False when the agency has not published that month yet. */
  published: boolean;

  grossUsd: number;
  modelShareUsd: number;
  deductionsUsd: number;
  deductionsBrl: number;
  /** Never negative: deductions beyond the share go to `remainingUsd`. */
  payableUsd: number;
  remainingUsd: number;

  modelPct: number;
  agencyPct: number;
  marketingPct: number;

  /** USD -> the model's currency, today's rate. Null when unavailable. */
  displayRate: ModelDashboardFxRate | null;
  deductions: LedgerDeduction[];
}

export interface ModelDashboardLedger {
  /** Transporte + hotel. */
  expenses: LedgerEntry[];
  loans: LedgerEntry[];
  expensesTotalBrl: number;
  /** Loans not yet deducted. */
  loansOutstandingBrl: number;
  notes: ModelDashboardNote[];
}

export interface ModelDashboardNote {
  id: string;
  body: string;
  createdAt: string;
}
