// Re-export core DB enums as TypeScript unions.
export type Platform = "instagram" | "x" | "tiktok" | "youtube" | "facebook" | "reddit" | "onlyfans" | "fansly";

export type BrandAccountStatus =
  | "not_requested"
  | "planning"
  | "awaiting_client_information"
  | "launch_packet_ready"
  | "awaiting_manual_account_creation"
  | "awaiting_verification"
  | "awaiting_connection"
  | "connected"
  | "active"
  | "authorization_expired"
  | "restricted"
  | "suspended"
  | "disconnected"
  | "archived";

export type ContentStatus =
  | "draft"
  | "ai_generated"
  | "awaiting_media"
  | "awaiting_client_approval"
  | "awaiting_agency_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "paused"
  | "rejected"
  | "archived";

export type ContentType =
  | "feed_image"
  | "feed_carousel"
  | "reel"
  | "story"
  | "x_post"
  | "x_thread"
  | "story_series";

export type AutomationMode = "manual" | "approval_based" | "controlled_autopilot";

export type AlertSeverity = "informational" | "recommendation" | "action_required" | "high_risk" | "critical";

export type ContentSource = "api" | "manual" | "ai_generated" | "imported" | "repurposed";

export type ResearchSourceType =
  | "official_guidance"
  | "first_party_data"
  | "public_observation"
  | "third_party_recommendation"
  | "unverified_opinion";

export type BrandRole =
  | "owner"
  | "administrator"
  | "brand_manager"
  | "content_manager"
  | "analyst"
  | "reviewer"
  | "representative"
  | "model";

// Talent = shared identity table.
export interface Talent {
  id: string;
  profileId: string | null;
  modelId: string | null;
  legalName: string | null;
  stageName: string | null;
  displayName: string;
  preferredUsername: string | null;
  pronunciation: string | null;
  email: string | null;
  whatsapp: string | null;
  birthday: string | null;
  age: number | null;
  location: string | null;
  nationality: string | null;
  languages: string[] | null;
  occupation: string | null;
  brandCategory: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface ServiceEnrollment {
  id: string;
  talentId: string;
  serviceTypeId: string;
  serviceTypeCode?: string;
  status: string;
  startedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfile {
  id: string;
  talentId: string;
  displayName: string | null;
  pronunciation: string | null;
  preferredUsername: string | null;
  alternateUsernames: string[] | null;
  age: number | null;
  location: string | null;
  nationality: string | null;
  languages: string[] | null;
  occupation: string | null;
  brandCategory: string | null;
  niche1: string;
  niche2: string | null;
  niche3: string | null;
  primaryPositioning: string | null;
  secondaryPositioning: string | null;
  customPositioning: string | null;
  targetCountries: string[] | null;
  targetCities: string[] | null;
  targetLanguages: string[] | null;
  targetGender: string | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  targetInterests: string[] | null;
  desiredPartnerships: string | null;
  desiredFollowerProfile: string | null;
  marketsToAvoid: string[] | null;
  objectives: Record<string, unknown>[];
  instagramAutomationMode: AutomationMode;
  xAutomationMode: AutomationMode;
  brandStatus: string;
  aiGuidance: string | null;
  dailyDirective: string | null;
  defaultLanguages: string[];
  allowAdultPlatformLinks: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientConsent {
  id: string;
  talentId: string;
  consentKey: string;
  granted: boolean;
  grantedAt: string | null;
  grantedByProfileId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientBoundaries {
  id: string;
  talentId: string;
  prohibitedSubjects: string[];
  prohibitedWords: string[];
  politicalBoundary: string | null;
  religiousBoundary: string | null;
  sexualBoundary: string | null;
  clothingBoundary: string | null;
  commentDmBoundary: string | null;
  accountsNotToMention: string[];
  privateDetailsNeverReveal: string[];
  crisisTopics: string[];
  neverGenerateNudity: boolean;
  neverImpersonateReal: boolean;
  neverMisleadingClaims: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAccount {
  id: string;
  talentId: string;
  platform: Platform;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  bio: string | null;
  profilePictureUrl: string | null;
  bannerUrl: string | null;
  isProfessional: boolean;
  status: BrandAccountStatus;
  followerCount: number;
  followingCount: number;
  postCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPillar {
  id: string;
  brandProfileId: string;
  name: string;
  description: string | null;
  platform: Platform | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  talentId: string;
  brandProfileId: string | null;
  socialAccountId: string | null;
  platform: Platform;
  contentType: ContentType;
  title: string | null;
  body: string | null;
  caption: string | null;
  hashtags: string[];
  keywords: string[];
  altText: string | null;
  cta: string | null;
  mediaAssetIds: string[];
  source: ContentSource;
  status: ContentStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  externalId: string | null;
  riskStatus: string | null;
  aiGenerationId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIGeneration {
  id: string;
  talentId: string;
  brandProfileId: string | null;
  platform: Platform | null;
  contentType: ContentType | null;
  objective: string | null;
  pillar: string | null;
  audience: string | null;
  language: string | null;
  inputData: Record<string, unknown>;
  output: Record<string, unknown>;
  tags: string[];
  cta: string | null;
  schedule: string | null;
  status: ContentStatus;
  riskStatus: string | null;
  generationSource: string | null;
  modelProvider: string | null;
  modelName: string | null;
  nichesUsed: string[];
  aiGuidanceUsed: string | null;
  dailyDirectiveUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchPacket {
  stageName: string;
  displayName: string;
  usernameOptions: string[];
  bioOptions: string[];
  profilePictureSpec: string;
  bannerSpec: string;
  linkInBio: string;
  contentPillars: string[];
  brandVoice: string;
  launchStrategy30Days: string;
  checklist: string[];
  accountTypeRecommendation: string;
  moderationRecommendation: string;
}

export interface GeneratedContent {
  caption: string;
  hashtags: string[];
  altText: string;
  cta: string;
  body: string;
  platform: Platform;
  contentType: ContentType;
  language: string;
  riskNotes: string[];
}

export interface DailyDirective {
  id: string;
  talentId: string;
  brandProfileId: string | null;
  platform: Platform;
  directiveDate: string;
  directive: string;
  authorProfileId: string | null;
  influencedItems: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  talentId: string | null;
  brandProfileId: string | null;
  socialAccountId: string | null;
  severity: AlertSeverity;
  alertType: string;
  title: string;
  message: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Manual X Playbook checklist item.
export interface PlaybookChecklistItem {
  id: string;
  brandProfileId: string;
  itemKey: string;
  title: string;
  description: string | null;
  category: "one_time" | "daily" | "weekly";
  platform: Platform;
  sortOrder: number;
  isActive: boolean;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Feature flags loaded from app_settings.
export interface BrandGrowthFeatureFlags {
  brandGrowthEnabled: boolean;
  featureXEnabled: boolean;
  ampliaTitle: string;
  ampliaInternalName: string;
}
