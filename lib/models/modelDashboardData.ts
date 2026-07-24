import "server-only";

import type {
  ModelDashboardChecklist,
  ModelDashboardEarnings,
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
  email,
  whatsapp,
  preferred_currency,
  content_frequency,
  block_brazil,
  show_face,
  referral_source,
  subscribers_count,
  ppv_sold_count,
  tips_amount,
  content_drive_url
`;

type DashboardModelRow = {
  id: string;
  stage_name: string | null;
  display_name: string;
  status: string | null;
  active: boolean;
  profile_photo_url: string | null;
  birthday: string | null;
  city: string | null;
  nationality: string | null;
  email: string | null;
  whatsapp: string | null;
  preferred_currency: string | null;
  content_frequency: string | null;
  block_brazil: boolean;
  show_face: boolean;
  referral_source: string | null;
  subscribers_count: number;
  ppv_sold_count: number;
  tips_amount: number;
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

type EarningsReportRow = {
  gross_revenue: number | null;
  model_share: number | null;
  agency_share: number | null;
  marketing_share: number | null;
  report_date: string | null;
  created_at: string;
  updated_at: string;
};

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
    preferredCurrency: row.preferred_currency,
    contentFrequency: row.content_frequency,
    blockBrazil: row.block_brazil,
    showFace: row.show_face,
    referralSource: row.referral_source,

    subscribersCount: row.subscribers_count ?? 0,
    ppvSoldCount: row.ppv_sold_count ?? 0,
    tipsAmount: Number(row.tips_amount ?? 0),

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

export function buildDashboardEarnings(
  paymentsRow: PaymentsRow,
  earningsRows: EarningsReportRow[],
): ModelDashboardEarnings {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const thisMonthRows = earningsRows.filter((report) => {
    const dateValue = report.report_date ?? report.created_at;
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return (
      date.getFullYear() === currentYear && date.getMonth() === currentMonth
    );
  });

  const totalThisMonth = sum(thisMonthRows, (r) => r.gross_revenue);
  const modelShareAmount = sum(thisMonthRows, (r) => r.model_share);
  const agencyShareAmount = sum(thisMonthRows, (r) => r.agency_share);
  const marketingShareAmount = sum(thisMonthRows, (r) => r.marketing_share);

  const lastUpdated = thisMonthRows.reduce<string | null>((latest, report) => {
    if (!latest) {
      return report.updated_at;
    }

    return new Date(report.updated_at) > new Date(latest)
      ? report.updated_at
      : latest;
  }, null);

  return {
    totalThisMonth,
    modelShareAmount,
    agencyShareAmount,
    marketingShareAmount,
    modelPct: Math.round(paymentsRow?.model_percentage ?? DEFAULT_MODEL_PCT),
    agencyPct: Math.round(
      paymentsRow?.agency_percentage ?? DEFAULT_AGENCY_PCT,
    ),
    marketingPct: Math.round(
      paymentsRow?.marketing_percentage ?? DEFAULT_MARKETING_PCT,
    ),
    lastUpdated,
  };
}

function sum(
  rows: EarningsReportRow[],
  pick: (row: EarningsReportRow) => number | null,
): number {
  return rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);
}
