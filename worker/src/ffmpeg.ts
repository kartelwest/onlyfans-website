import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import ffmpeg from "fluent-ffmpeg";

export interface FfmpegInput {
  inputPath: string;
  outputPath: string;
  durationSeconds?: number;
  settings: Record<string, unknown>;
  lowerThirdText?: string;
  watermarkText?: string;
  targetResolution?: { width: number; height: number } | null;
  modelName?: string;
  brandName?: string;
}

const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

export async function probeVideo(inputPath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  streams: ffmpeg.FfprobeStream[];
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = data.streams.find((s) => s.codec_type === "video");

      resolve({
        duration: data.format.duration ?? 0,
        width: videoStream?.width ?? 0,
        height: videoStream?.height ?? 0,
        streams: data.streams,
      });
    });
  });
}

export function renderVideo(input: FfmpegInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(input.inputPath);

    const settings = input.settings;
    const trimStart = Number(settings.trimStartSeconds ?? 0);
    const trimEnd = settings.trimEndSeconds ? Number(settings.trimEndSeconds) : undefined;

    if (trimStart > 0) {
      command.seekInput(trimStart);
    }
    if (trimEnd && trimEnd > trimStart) {
      command.duration(trimEnd - trimStart);
    }

    const targetResolution = input.targetResolution;
    const filters: string[] = [];

    if (targetResolution && targetResolution.width > 0 && targetResolution.height > 0) {
      const w = targetResolution.width;
      const h = targetResolution.height;
      // Scale to fill target while cropping excess (center crop)
      filters.push(
        `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(in_w-out_w)/2:(in_h-out_h)/2`,
      );
    }

    if (typeof settings.brightness === "number" || typeof settings.contrast === "number" || typeof settings.saturation === "number") {
      const brightness = Number(settings.brightness ?? 0);
      const contrast = Number(settings.contrast ?? 1);
      const saturation = Number(settings.saturation ?? 1);
      filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
    }

    if (typeof settings.sharpness === "number") {
      const sharpness = Number(settings.sharpness);
      if (sharpness > 0) {
        filters.push(`unsharp=5:5:${sharpness}:5:5:0`);
      }
    }

    if (settings.denoise) {
      filters.push("nlmeans=s=10:p=7:r=15");
    }

    const lowerThird = settings.lowerThird as Record<string, unknown> | undefined;
    if (lowerThird?.enabled) {
      const text = String(lowerThird.text || input.modelName || input.brandName || "");
      if (text) {
        const position = String(lowerThird.position || "bottom_left");
        const fontSize = Number(lowerThird.fontSize || 28);
        const fontColor = String(lowerThird.fontColor || "#ffffff");
        const bgColor = lowerThird.backgroundColor ? String(lowerThird.backgroundColor) : "0x000000@0.5";
        const { x, y } = drawtextPosition(position, true);
        filters.push(
          `drawtext=fontfile=${FONT_PATH}:text='${escapeDrawtext(text)}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${bgColor}:x=${x}:y=${y}:boxborderw=6`,
        );
      }
    }

    const watermark = settings.watermark as Record<string, unknown> | undefined;
    if (watermark?.enabled) {
      const text = String(watermark.text || input.brandName || "");
      if (text) {
        const position = String(watermark.position || "bottom_right");
        const fontSize = Number(watermark.size || 60);
        const opacity = Number(watermark.opacity ?? 0.5);
        const fontColor = `0x${(fontSize > 0 ? "ffffff" : "ffffff")}`;
        const alpha = `alpha=${opacity}`;
        const { x, y } = drawtextPosition(position, false);
        filters.push(
          `drawtext=fontfile=${FONT_PATH}:text='${escapeDrawtext(text)}':fontsize=${fontSize}:fontcolor=${fontColor}@${opacity}:x=${x}:y=${y}:${alpha}`,
        );
      }
    }

    if (settings.fadeIn) {
      filters.push("fade=t=in:st=0:d=1");
    }

    // Audio
    const volume = typeof settings.volume === "number" ? Number(settings.volume) : undefined;
    const audioFilters: string[] = [];
    if (volume !== undefined && volume !== 1) {
      audioFilters.push(`volume=${volume}`);
    }
    if (settings.mute) {
      command.noAudio();
    } else if (audioFilters.length > 0) {
      command.audioFilters(audioFilters);
    }

    // Ensure YUV420p for compatibility
    filters.push("format=yuv420p");

    if (filters.length > 0) {
      command.videoFilters(filters);
    }

    command
      .outputOptions([
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
      ])
      .on("start", (cmd) => {
        console.log("[FFmpeg] command:", cmd);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`[FFmpeg] progress: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on("error", (err) => {
        reject(err);
      })
      .on("end", () => {
        resolve();
      })
      .save(input.outputPath);
  });
}

function drawtextPosition(
  position: string,
  isLowerThird: boolean,
): { x: string; y: string } {
  const margin = isLowerThird ? 40 : 24;

  switch (position) {
    case "top_left":
      return { x: `(${margin})`, y: `(${margin})` };
    case "top_center":
      return { x: "(w-text_w)/2", y: `${margin}` };
    case "top_right":
      return { x: `(w-text_w-${margin})`, y: `${margin}` };
    case "middle_left":
      return { x: `${margin}`, y: "(h-text_h)/2" };
    case "middle_center":
      return { x: "(w-text_w)/2", y: "(h-text_h)/2" };
    case "middle_right":
      return { x: `(w-text_w-${margin})`, y: "(h-text_h)/2" };
    case "bottom_left":
      return { x: `${margin}`, y: `(h-text_h-${margin})` };
    case "bottom_center":
      return { x: "(w-text_w)/2", y: `(h-text_h-${margin})` };
    case "bottom_right":
    default:
      return { x: `(w-text_w-${margin})`, y: `(h-text_h-${margin})` };
  }
}

function escapeDrawtext(text: string): string {
  return text.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");
}

export async function ensureTempDir(): Promise<string> {
  const dir = path.join("/tmp", "karay-video-worker", randomUUID());
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupDir(dir: string): Promise<void> {
  try {
    const files = await readdir(dir);
    for (const file of files) {
      await stat(path.join(dir, file));
    }
  } catch {
    // ignore
  }
}

export async function streamToFile(stream: Readable, filePath: string): Promise<void> {
  const { createWriteStream } = await import("node:fs");
  await pipeline(stream, createWriteStream(filePath));
}

export { execFile, randomUUID, path };
