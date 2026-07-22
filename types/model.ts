export type ManagementRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

export type ChecklistStatus =
  | "not_started"
  | "planned"
  | "in_progress"
  | "completed"
  | "missing"
  | "inactive"
  | "duplicate"
  | "blocked";

export interface Model {
  id: string;

  profileId: string | null;

  modelNumber: number | null;

  slug: string;

  displayName: string;

  fullName: string;

  stageName: string | null;

  birthday: string | null;

  nationality: string | null;

  city: string | null;

  language: string | null;

  email: string | null;

  whatsapp: string | null;

  representativeId: string | null;

  onboardingPercentage: number;

  instagram: string | null;

  twitter: string | null;

  reddit: string | null;

  tiktok: string | null;

  youtube: string | null;

  facebook: string | null;

  onlyfans: string | null;

  fansly: string | null;

  driveOnlyfans: string | null;

  driveInstagram: string | null;

  driveTwitter: string | null;

  driveVideosUrl: string | null;

  drivePhotosUrl: string | null;

  status: string | null;

  onboardingComplete: boolean;

  active: boolean;

  websiteLoginEnabled?: boolean;

  profilePhotoUrl: string | null;

  latestNoteSummary: string | null;

  lastLoginAt: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface ModelChecklist {
  modelId: string;

  onlyfansStatus: ChecklistStatus;

  fanslyStatus: ChecklistStatus;

  instagramStatus: ChecklistStatus;

  twitterStatus: ChecklistStatus;

  redditStatus: ChecklistStatus;

  tiktokStatus: ChecklistStatus;

  youtubeStatus: ChecklistStatus;

  facebookStatus: ChecklistStatus;

  googleDriveStatus: ChecklistStatus;

  websiteLoginStatus: ChecklistStatus;

  contractStatus: ChecklistStatus;

  modelReleaseStatus: ChecklistStatus;

  identityDocumentStatus: ChecklistStatus;

  cpfStatus: ChecklistStatus;

  pixStatus: ChecklistStatus;

  bankAccountStatus: ChecklistStatus;

  onlyfansVerificationStatus: ChecklistStatus;

  fanslyVerificationStatus: ChecklistStatus;

  welcomeCallStatus: ChecklistStatus;

  contentReceivedStatus: ChecklistStatus;

  onboardingPercentage: number;

  createdAt: string;

  updatedAt: string;
}

export interface ModelPlatform {
  id: string;

  modelId: string;

  platformName: string;

  username: string | null;

  profileUrl: string | null;

  status: ChecklistStatus;

  notes: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface ModelDriveFolder {
  id: string;

  modelId: string;

  folderName: string;

  platform: string | null;

  folderUrl: string | null;

  folderId: string | null;

  status: ChecklistStatus;

  createdAt: string;

  updatedAt: string;
}

export interface ModelDocument {
  id: string;

  modelId: string;

  documentType: string;

  documentName: string | null;

  documentUrl: string | null;

  status: ChecklistStatus;

  expirationDate: string | null;

  notes: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface ModelPayment {
  id: string;

  modelId: string;

  pixKey: string | null;

  pixType: string | null;

  bankName: string | null;

  bankAccount: string | null;

  bankAgency: string | null;

  accountHolderName: string | null;

  accountHolderCpf: string | null;

  paymentFrequency: string | null;

  modelPercentage: number | null;

  agencyPercentage: number | null;

  marketingPercentage: number | null;

  status: ChecklistStatus;

  createdAt: string;

  updatedAt: string;
}

export interface ModelNote {
  id: string;

  modelId: string;

  authorId: string;

  authorName: string | null;

  authorRole: ManagementRole | null;

  content: string;

  createdAt: string;

  updatedAt: string;
}

export interface ModelAuditLog {
  id: string;

  modelId: string;

  actorId: string | null;

  actorName: string | null;

  actorRole: ManagementRole | null;

  field: string;

  oldValue: string | null;

  newValue: string | null;

  createdAt: string;
}