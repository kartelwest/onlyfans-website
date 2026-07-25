import type { ManagementRole } from "@/types/model";

export type AmpliaPlatform = "instagram" | "x";

export type ServiceEnrollmentStatus =
  | "inactive"
  | "planning"
  | "active"
  | "paused"
  | "archived";

export type BrandProfileStatus = "draft" | "active" | "archived";

export type ConsentType =
  | "legal_name_use"
  | "face_use"
  | "voice_use"
  | "ai_generated_image_use"
  | "ai_enhanced_image_use"
  | "ai_generated_video_use"
  | "location_age_relationship_disclosure"
  | "adult_platform_links"
  | "content_repurposing"
  | "cross_platform_publishing"
  | "automatic_publishing"
  | "ai_generated_replies"
  | "data_use_for_strategy";

export const CONSENT_TYPES: { value: ConsentType; label: string }[] = [
  { value: "legal_name_use", label: "Uso do nome legal" },
  { value: "face_use", label: "Uso do rosto" },
  { value: "voice_use", label: "Uso da voz" },
  { value: "ai_generated_image_use", label: "Imagens geradas por IA" },
  { value: "ai_enhanced_image_use", label: "Imagens aprimoradas por IA" },
  { value: "ai_generated_video_use", label: "Vídeos gerados por IA" },
  {
    value: "location_age_relationship_disclosure",
    label: "Divulgação de localização/idade/status de relacionamento",
  },
  { value: "adult_platform_links", label: "Links para plataformas adultas" },
  { value: "content_repurposing", label: "Reaproveitamento de conteúdo" },
  { value: "cross_platform_publishing", label: "Publicação entre plataformas" },
  { value: "automatic_publishing", label: "Publicação automática" },
  { value: "ai_generated_replies", label: "Respostas geradas por IA" },
  { value: "data_use_for_strategy", label: "Uso de dados para estratégia" },
];

export interface Talent {
  id: string;
  linkedModelId: string | null;
  legalName: string | null;
  stageName: string;
  displayName: string;
  pronunciation: string | null;
  preferredUsername: string | null;
  alternateUsernames: string[];
  approvedAge: number | null;
  location: string | null;
  nationality: string | null;
  languages: string[];
  occupation: string | null;
  brandCategory: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  id: string;
  key: string;
  displayName: string;
  category: "onlyfans_track" | "brand_growth";
  platform: AmpliaPlatform | null;
  active: boolean;
}

export interface ServiceEnrollment {
  id: string;
  talentId: string;
  serviceTypeId: string;
  status: ServiceEnrollmentStatus;
  enrolledAt: string | null;
  notes: string | null;
}

export interface BrandProfile {
  id: string;
  talentId: string;
  niche1: string;
  niche2: string | null;
  niche3: string | null;
  aiGuidance: string | null;
  primaryPositioning: string | null;
  secondaryPositioning: string[];
  brandVoice: string | null;
  targetCountries: string[];
  targetCities: string[];
  targetLanguages: string[];
  targetGender: string | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  targetInterests: string[];
  desiredPartnerships: string | null;
  marketsToAvoid: string[];
  topicsToAvoid: string[];
  status: BrandProfileStatus;
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
  commentBoundary: string | null;
  dmBoundary: string | null;
  accountsNotToMention: string[];
  privateDetailsNeverReveal: string[];
  crisisTopics: string[];
}

export interface GrowthGoal {
  id: string;
  talentId: string;
  platform: AmpliaPlatform | null;
  objective: string;
  priority: "low" | "medium" | "high";
  startValue: number | null;
  targetValue: number | null;
  targetDate: string | null;
  measurementMethod: string | null;
  status: "active" | "achieved" | "missed" | "archived";
}

export interface AmpliaSession {
  userId: string;
  fullName: string;
  role: Extract<ManagementRole, "owner" | "administrator">;
}
