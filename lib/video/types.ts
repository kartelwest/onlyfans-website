import { z } from "zod";

export const videoJobStatuses = [
  "new",
  "awaiting_configuration",
  "awaiting_approval",
  "queued",
  "downloading",
  "preparing",
  "processing",
  "rendering_captions",
  "rendering",
  "sending",
  "completed",
  "failed",
  "cancelled",
] as const;

export const videoSourceTypes = ["manual_upload", "google_drive"] as const;

export const videoPlatforms = [
  "instagram_reels",
  "instagram_stories",
  "tiktok",
  "youtube_shorts",
  "x",
  "reddit",
  "onlyfans",
  "fansly",
  "custom",
] as const;

export const videoAspects = [
  "vertical_9_16",
  "square_1_1",
  "portrait_4_5",
  "landscape_16_9",
  "original",
] as const;

export type VideoJobStatus = (typeof videoJobStatuses)[number];
export type VideoSourceType = (typeof videoSourceTypes)[number];
export type VideoPlatform = (typeof videoPlatforms)[number];
export type VideoAspect = (typeof videoAspects)[number];

export const videoPlatformLabels: Record<VideoPlatform, string> = {
  instagram_reels: "Instagram Reels",
  instagram_stories: "Instagram Stories",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  x: "X",
  reddit: "Reddit",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
  custom: "Personalizado",
};

export const videoAspectLabels: Record<VideoAspect, string> = {
  vertical_9_16: "9:16 Vertical",
  square_1_1: "1:1 Quadrado",
  portrait_4_5: "4:5 Retrato",
  landscape_16_9: "16:9 Paisagem",
  original: "Original",
};

export const textPositionSchema = z.enum([
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "middle_center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
]);

export const videoTemplateSettingsSchema = z.object({
  trimStartSeconds: z.number().min(0).optional(),
  trimEndSeconds: z.number().min(0).optional(),
  removeSegments: z
    .array(z.object({ start: z.number().min(0), end: z.number().min(0) }))
    .optional(),
  speed: z.number().positive().optional(),
  volume: z.number().min(0).max(2).optional(),
  mute: z.boolean().optional(),
  normalizeAudio: z.boolean().optional(),
  brightness: z.number().optional(),
  contrast: z.number().optional(),
  saturation: z.number().optional(),
  gamma: z.number().optional(),
  sharpness: z.number().optional(),
  denoise: z.boolean().optional(),
  lowerThird: z
    .object({
      enabled: z.boolean(),
      text: z.string().max(120).optional(),
      position: textPositionSchema.default("bottom_left"),
      fontSize: z.number().positive().default(24),
      fontColor: z.string().default("#ffffff"),
      backgroundColor: z.string().optional(),
      durationSeconds: z.number().positive().optional(),
      startSeconds: z.number().min(0).default(0),
    })
    .optional(),
  watermark: z
    .object({
      enabled: z.boolean(),
      brandAssetId: z.string().uuid().optional(),
      text: z.string().max(80).optional(),
      position: textPositionSchema.default("bottom_right"),
      size: z.number().positive().default(60),
      opacity: z.number().min(0).max(1).default(0.5),
      startSeconds: z.number().min(0).default(0),
      durationSeconds: z.number().positive().optional(),
    })
    .optional(),
  introBrandAssetId: z.string().uuid().optional(),
  outroBrandAssetId: z.string().uuid().optional(),
  backgroundMusicBrandAssetId: z.string().uuid().optional(),
  backgroundMusicVolume: z.number().min(0).max(1).default(0.2),
  outputFormat: z.enum(["mp4", "mov", "webm"]).default("mp4"),
  videoCodec: z.enum(["libx264", "libx265", "libvpx-vp9"]).default("libx264"),
  audioCodec: z.enum(["aac", "libmp3lame"]).default("aac"),
  frameRate: z.number().positive().optional(),
  bitrate: z.string().optional(),
  maxFileSizeBytes: z.number().positive().optional(),
  caption: z
    .object({
      enabled: z.boolean(),
      language: z.enum(["pt", "en", "es"]).default("pt"),
      style: z.enum(["burned", "srt"]).default("burned"),
      fontSize: z.number().positive().default(24),
      fontColor: z.string().default("#ffffff"),
      backgroundColor: z.string().optional(),
      position: textPositionSchema.default("bottom_center"),
    })
    .optional(),
});

export const videoTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  targetPlatform: z.enum(videoPlatforms).default("custom"),
  aspect: z.enum(videoAspects).default("original"),
  resolutionWidth: z.number().positive().optional(),
  resolutionHeight: z.number().positive().optional(),
  maxDurationSeconds: z.number().positive().optional(),
  settings: videoTemplateSettingsSchema.default({}),
  isActive: z.boolean().default(true),
  isGlobal: z.boolean().default(true),
  modelId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
});

export const videoJobCreateSchema = z.object({
  assetId: z.string().uuid(),
  templateId: z.string().uuid(),
  naturalLanguageInstructions: z.string().max(2000).optional(),
});

export const videoJobActionSchema = z.object({
  jobId: z.string().uuid(),
});

export type VideoTemplateSettings = z.infer<typeof videoTemplateSettingsSchema>;
export type VideoTemplateInput = z.infer<typeof videoTemplateSchema>;

export interface VideoJobRow {
  id: string;
  assetId: string;
  templateId: string | null;
  instructionId: string | null;
  createdBy: string | null;
  status: VideoJobStatus;
  progress: number;
  retryCount: number;
  costEstimate: number;
  costActual: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  processingMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAssetRow {
  id: string;
  modelId: string;
  sourceType: VideoSourceType;
  folderId: string | null;
  originalFilename: string;
  storagePath: string | null;
  driveFileId: string | null;
  driveFileUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fileHash: string | null;
  metadata: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface VideoTemplateRow extends VideoTemplateInput {
  createdBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
