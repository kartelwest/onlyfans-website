// Data contract for the rep/model-self "Model Dashboard" (KARAY Models).
// Deliberately separate from types/model.ts (the admin CRM's full Model
// type): this view only ever needs a small, fixed slice of fields, and
// keeping it separate means the two never drift into needing the same shape.

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
  preferredCurrency: string | null;
  contentFrequency: string | null;
  blockBrazil: boolean;
  showFace: boolean;
  referralSource: string | null;

  subscribersCount: number;
  ppvSoldCount: number;
  tipsAmount: number;

  contentDriveUrl: string | null;
}

export interface ModelDashboardChecklist {
  applicationApproved: boolean;
  onlyfansAccountCreated: boolean;
  socialAccountsConfigured: boolean;
  proxyBrowserReady: boolean;
  firstContentReceived: boolean;
  contractSigned: boolean;
}

export interface ModelDashboardEarnings {
  totalThisMonth: number;
  modelShareAmount: number;
  agencyShareAmount: number;
  marketingShareAmount: number;
  modelPct: number;
  agencyPct: number;
  marketingPct: number;
  lastUpdated: string | null;
}
