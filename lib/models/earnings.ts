export type EarningsReportRow = {
  id: string;
  model_id: string;
  platform: string | null;
  period: string | null;
  gross_revenue: number | null;
  model_share: number | null;
  agency_share: number | null;
  marketing_share: number | null;
  report_date: string | null;
  visible_to_model: boolean | null;
  admin_note: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

export type EarningsReport = {
  id: string;
  modelId: string;
  platform: string | null;
  period: string | null;
  grossRevenue: number | null;
  modelShare: number | null;
  agencyShare: number | null;
  marketingShare: number | null;
  reportDate: string | null;
  visibleToModel: boolean | null;
  adminNote: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Maps a `model_earnings_reports` row to the camelCase API shape. */
export function mapEarningsReport(
  row: EarningsReportRow,
  imageUrl: string | null,
): EarningsReport {
  return {
    id: row.id,
    modelId: row.model_id,
    platform: row.platform,
    period: row.period,
    grossRevenue: row.gross_revenue,
    modelShare: row.model_share,
    agencyShare: row.agency_share,
    marketingShare: row.marketing_share,
    reportDate: row.report_date,
    visibleToModel: row.visible_to_model,
    adminNote: row.admin_note,
    imagePath: row.image_path,
    imageUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
