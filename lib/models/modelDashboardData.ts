import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { agencyToday, previousMonthPeriod } from "@/lib/earnings/period";
import { getFxRate } from "@/lib/fx/rates";
import { computePayout } from "@/lib/earnings/payout";
import {
  LEDGER_ENTRY_COLUMNS,
  mapLedgerEntry,
  selectDeductionsForPeriod,
  type LedgerEntryRow,
} from "@/lib/ledger/entries";
import { snapshotDueLedgerEntries } from "@/lib/ledger/snapshot";
import {
  USD,
  currencyForCountry,
  normalizeCurrencyCode,
} from "@/lib/money/currency";

import type { LedgerEntry } from "@/types/ledger";
import type {
  ModelDashboardChecklist,
  ModelDashboardEarnings,
  ModelDashboardLedger,
  ModelDashboardModel,
} from "@/types/modelDashboard";

// Shared between the representative view and the model self-view — both
// render the exact same restricted dashboard, just with a different
// canEditAvatar flag. Never includes instagram_marketing / twitter_marketing:
// those columns aren't selectable by the `authenticated` Postgres role at
// all (see the models_column_select_allowlist migration), so an accidental
// addition here would fail loudly instead of leaking silently.
export const DASHBOARD_MODEL_COLUMNS = `
  id,
  profile_id,
  representative_id,
  stage_name,
  display_name,
  status,
  active,
  profile_photo_url,
  birthday,
  city,
  nationality,
  country_code,
  email,
  whatsapp,
  preferred_currency,
  expenses_enabled,
  content_frequency,
  block_brazil,
  show_face,
  referral_source,
  content_drive_url
`;

export type DashboardModelRow = {
  id: string;
  stage_name: string | null;
  display_name: string;
  status: string | null;
  active: boolean;
  profile_photo_url: string | null;
  birthday: string | null;
  city: string | null;
  nationality: string | null;
  country_code: string | null;
  email: string | null;
  whatsapp: string | null;
  preferred_currency: string | null;
  expenses_enabled: boolean;
  content_frequency: string | null;
  block_brazil: boolean;
  show_face: boolean;
  referral_source: string | null;
  content_drive_url: string | null;
};

type ChecklistRow = {
  onlyfans_status: string | null;
  instagram_status: string | null;
  twitter_status: string | null;
  proxy_browser_status: string | null;
  contract_status: string | null;
  content_received_status: string | null;
} | null;

type PaymentsRow = {
  model_percentage: number | null;
  agency_percentage: number | null;
  marketing_percentage: number | null;
} | null;

export function buildDashboardModel(
  row: DashboardModelRow,
): ModelDashboardModel {
  return {
    id: row.id,
    stageName: row.stage_name || row.display_name,
    fullName: row.display_name,
    active: row.active,
    profilePhotoUrl: row.profile_photo_url,

    birthday: row.birthday,
    location: buildLocation(row.city, row.nationality),
    email: row.email,
    whatsapp: row.whatsapp,
    // An explicit currency wins; otherwise the country decides, and USD is the
    // last resort — earnings are stored in USD, so that is never nonsense.
    currency:
      normalizeCurrencyCode(row.preferred_currency) ??
      currencyForCountry(row.country_code),
    countryCode: row.country_code,
    contentFrequency: row.content_frequency,
    blockBrazil: row.block_brazil,
    showFace: row.show_face,
    referralSource: row.referral_source,

    contentDriveUrl: row.content_drive_url,
  };
}

function buildLocation(
  city: string | null,
  nationality: string | null,
): string | null {
  const parts = [city, nationality].filter(
    (part): part is string => Boolean(part && part.trim()),
  );

  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ");
}

const COMPLETED_STATUS = "completed";

export function buildDashboardChecklist(
  modelRow: Pick<DashboardModelRow, "status">,
  checklistRow: ChecklistRow,
): ModelDashboardChecklist {
  return {
    applicationApproved: modelRow.status !== "candidate",
    onlyfansAccountCreated:
      checklistRow?.onlyfans_status === COMPLETED_STATUS,
    socialAccountsConfigured:
      checklistRow?.instagram_status === COMPLETED_STATUS ||
      checklistRow?.twitter_status === COMPLETED_STATUS,
    proxyBrowserReady:
      checklistRow?.proxy_browser_status === COMPLETED_STATUS,
    firstContentReceived:
      checklistRow?.content_received_status === COMPLETED_STATUS,
    contractSigned: checklistRow?.contract_status === COMPLETED_STATUS,
  };
}

const DEFAULT_MODEL_PCT = 60;
const DEFAULT_AGENCY_PCT = 20;
const DEFAULT_MARKETING_PCT = 20;

export type DashboardFinance = {
  earnings: ModelDashboardEarnings;
  /** Null — not an empty object — when the model is not on the ledger
   *  feature, so the sections are absent from the payload entirely. */
  ledger: ModelDashboardLedger | null;
};

/**
 * Everything money-related on the dashboard, for the previous calendar month.
 *
 * `supabase` is the request-scoped client, so every read is RLS-checked as the
 * viewer (model or assigned rep). `admin` is only used for the FX cache and the
 * lazy deduction snapshot, which are system operations with no acting user.
 */
export async function loadDashboardFinance({
  supabase,
  admin,
  model,
  paymentsRow,
  expensesEnabled,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  model: ModelDashboardModel;
  paymentsRow: PaymentsRow;
  expensesEnabled: boolean;
  now?: Date;
}): Promise<DashboardFinance> {
  const period = previousMonthPeriod(now);

  const modelPct = Math.round(
    paymentsRow?.model_percentage ?? DEFAULT_MODEL_PCT,
  );

  // A missed cron must never leave a due deduction unapplied, so the snapshot
  // also runs here, on read, before anything is summed.
  if (expensesEnabled) {
    await snapshotDueLedgerEntries(admin, { modelId: model.id, now });
  }

  const [{ data: earningsRow }, entries] = await Promise.all([
    supabase
      .from("model_earnings_reports")
      .select("gross_revenue")
      .eq("model_id", model.id)
      .eq("period_month", period.periodMonth)
      .eq("visible_to_model", true)
      .maybeSingle(),
    expensesEnabled ? loadLedgerEntries(supabase, model.id) : [],
  ]);

  const grossUsd = earningsRow ? Number(earningsRow.gross_revenue ?? 0) : 0;

  const deductions = selectDeductionsForPeriod(entries, period.periodMonth);

  const deductionsUsd = deductions.reduce(
    (total, deduction) => total + deduction.amountUsd,
    0,
  );

  const deductionsBrl = deductions.reduce(
    (total, deduction) => total + deduction.amountBrl,
    0,
  );

  const { modelShareUsd, payableUsd, remainingUsd } = computePayout({
    grossUsd,
    modelPct,
    deductionsUsd,
  });

  const displayRate = await loadDisplayRate(admin, model.currency, now);

  const earnings: ModelDashboardEarnings = {
    periodTitle: period.title,
    periodMonthName: period.monthName,
    published: Boolean(earningsRow),
    grossUsd,
    modelShareUsd,
    deductionsUsd,
    deductionsBrl,
    payableUsd,
    remainingUsd,
    modelPct,
    agencyPct: Math.round(
      paymentsRow?.agency_percentage ?? DEFAULT_AGENCY_PCT,
    ),
    marketingPct: Math.round(
      paymentsRow?.marketing_percentage ?? DEFAULT_MARKETING_PCT,
    ),
    displayRate,
    deductions,
  };

  if (!expensesEnabled) {
    return { earnings, ledger: null };
  }

  const expenses = entries.filter(
    (entry) => entry.entryType === "transporte" || entry.entryType === "hotel",
  );

  const loans = entries.filter((entry) => entry.entryType === "emprestimo");

  const notes = await loadLedgerNotes(supabase, model.id);

  return {
    earnings,
    ledger: {
      expenses,
      loans,
      expensesTotalBrl: sumBrl(expenses),
      loansOutstandingBrl: sumBrl(
        loans.filter((entry) => entry.deductedAt === null),
      ),
      notes,
    },
  };
}

export type ModelDashboardData = {
  model: ModelDashboardModel;
  checklist: ModelDashboardChecklist;
  earnings: ModelDashboardEarnings;
  ledger: ModelDashboardLedger | null;
};

/**
 * The whole dashboard payload for one already-loaded model row.
 *
 * Every entry point into this screen goes through here — the model's own
 * /area-da-modelo, the rep's /representative/models/[id], and the two admin
 * previews of each. They render the same component, so they must read the same
 * way; the caller only decides WHICH row it is allowed to fetch.
 */
export async function loadModelDashboard({
  supabase,
  admin,
  modelRow,
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  modelRow: DashboardModelRow;
}): Promise<ModelDashboardData> {
  const [{ data: checklistRow }, { data: paymentsRow }] = await Promise.all([
    supabase
      .from("model_checklist")
      .select(
        "onlyfans_status, instagram_status, twitter_status, proxy_browser_status, contract_status, content_received_status",
      )
      .eq("model_id", modelRow.id)
      .maybeSingle(),
    supabase
      .from("model_payments")
      .select("model_percentage, agency_percentage, marketing_percentage")
      .eq("model_id", modelRow.id)
      .maybeSingle(),
  ]);

  const model = buildDashboardModel(modelRow);
  const checklist = buildDashboardChecklist(modelRow, checklistRow);

  const { earnings, ledger } = await loadDashboardFinance({
    supabase,
    admin,
    model,
    paymentsRow,
    expensesEnabled: modelRow.expenses_enabled === true,
  });

  return { model, checklist, earnings, ledger };
}

async function loadLedgerEntries(
  supabase: SupabaseClient,
  modelId: string,
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from("model_ledger_entries")
    .select(LEDGER_ENTRY_COLUMNS)
    .eq("model_id", modelId)
    .is("deleted_at", null)
    .order("incurred_on", { ascending: false });

  if (error) {
    console.error("Falha ao carregar lançamentos da modelo:", error);
    return [];
  }

  return ((data ?? []) as unknown as LedgerEntryRow[]).map(mapLedgerEntry);
}

/**
 * Only `source = 'ledger'` notes ever reach a model or a rep. The filter is in
 * the query (and backed by the notes_select_ledger policy), not in the
 * component, so internal notes are absent from the payload, not just hidden.
 */
async function loadLedgerNotes(supabase: SupabaseClient, modelId: string) {
  const { data, error } = await supabase
    .from("model_notes")
    .select("id, body, created_at")
    .eq("model_id", modelId)
    .eq("source", "ledger")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Falha ao carregar notas de lançamentos:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  }));
}

async function loadDisplayRate(
  admin: SupabaseClient,
  currency: string,
  now: Date,
) {
  const rate = await getFxRate(admin, USD, currency, agencyToday(now), now);

  if (!rate) {
    return null;
  }

  return { rate: rate.rate, rateDate: rate.rateDate, stale: rate.stale };
}

function sumBrl(entries: LedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amountBrl, 0);
}
