import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import { ensureTempDir, probeVideo, renderVideo } from "./ffmpeg.js";
import { downloadOriginal, editedBucket, supabaseAdmin, uploadEdited } from "./storage.js";

const POLL_INTERVAL_MS = Number(process.env.VIDEO_WORKER_POLL_INTERVAL_MS ?? 15000);
const MAX_RETRIES = 3;

async function main() {
  console.log("[worker] KarayModels video worker started");

  while (true) {
    try {
      await processNextJob();
    } catch (err) {
      console.error("[worker] unexpected loop error:", err);
    }

    await setTimeout(POLL_INTERVAL_MS);
  }
}

async function processNextJob() {
  const { data: locked, error: lockError } = await supabaseAdmin
    .from("video_jobs")
    .update({ status: "downloading", started_at: new Date().toISOString() })
    .eq("status", "queued")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (lockError) {
    console.error("[worker] lock error:", lockError);
    return;
  }

  const jobId = locked?.[0]?.id;
  if (!jobId) {
    return;
  }

  console.log(`[worker] picked up job ${jobId}`);

  const { data: job } = await supabaseAdmin
    .from("video_jobs")
    .select(
      `
      id,
      retry_count,
      asset:asset_id (
        id,
        storage_path,
        original_filename,
        mime_type,
        model:model_id (
          id,
          display_name,
          stage_name
        )
      ),
      template:template_id (
        id,
        name,
        target_platform,
        aspect,
        resolution_width,
        resolution_height,
        max_duration_seconds,
        settings
      )
    `,
    )
    .eq("id", jobId)
    .single();

  if (!job) {
    console.error(`[worker] job ${jobId} not found after lock`);
    return;
  }

  const typedJob = job as unknown as {
    id: string;
    retry_count: number;
    asset: {
      id: string;
      storage_path: string | null;
      original_filename: string;
      mime_type: string | null;
      model: {
        id: string;
        display_name: string;
        stage_name: string | null;
      } | null;
    } | null;
    template: {
      id: string;
      name: string;
      target_platform: string;
      aspect: string;
      resolution_width: number | null;
      resolution_height: number | null;
      max_duration_seconds: number | null;
      settings: Record<string, unknown>;
    } | null;
  };

  let tempDir = "";

  try {
    if (!typedJob.asset?.storage_path) {
      throw new Error("Asset has no storage path");
    }

    if (!typedJob.template) {
      throw new Error("Job has no template");
    }

    tempDir = await ensureTempDir();
    const ext = path.extname(typedJob.asset.original_filename) || ".mp4";
    const inputPath = path.join(tempDir, `input${ext}`);
    const outputPath = path.join(tempDir, `output.mp4`);

    await updateJobStatus(jobId, "downloading");
    await downloadOriginal(typedJob.asset.storage_path, inputPath);
    await logJob(jobId, "info", "Downloaded original file", { path: typedJob.asset.storage_path });

    await updateJobStatus(jobId, "preparing");
    const probe = await probeVideo(inputPath);
    await supabaseAdmin
      .from("video_assets")
      .update({
        duration_seconds: probe.duration,
        width: probe.width,
        height: probe.height,
      })
      .eq("id", typedJob.asset.id);

    const targetResolution = getTargetResolution(typedJob.template);

    if (
      typedJob.template.max_duration_seconds &&
      probe.duration > typedJob.template.max_duration_seconds
    ) {
      // If not trimmed, the output will be longer than allowed; fail gracefully.
      const trimEnd = Number(typedJob.template.settings.trimEndSeconds ?? 0);
      const trimStart = Number(typedJob.template.settings.trimStartSeconds ?? 0);
      const finalDuration = trimEnd > trimStart ? trimEnd - trimStart : probe.duration;
      if (finalDuration > typedJob.template.max_duration_seconds) {
        throw new Error(
          `Vídeo excede a duração máxima de ${typedJob.template.max_duration_seconds}s`,
        );
      }
    }

    await updateJobStatus(jobId, "processing");
    await logJob(jobId, "info", "Starting FFmpeg render", { targetResolution });

    const lowerThirdText =
      String((typedJob.template.settings.lowerThird as Record<string, unknown> | undefined)?.text || "") ||
      typedJob.asset.model?.stage_name ||
      typedJob.asset.model?.display_name ||
      "";

    const watermarkText =
      String((typedJob.template.settings.watermark as Record<string, unknown> | undefined)?.text || "") ||
      "KarayModels";

    await renderVideo({
      inputPath,
      outputPath,
      settings: typedJob.template.settings,
      targetResolution,
      lowerThirdText,
      watermarkText,
      modelName: typedJob.asset.model?.display_name,
      brandName: "KarayModels",
    });

    await updateJobStatus(jobId, "sending");
    const outputStoragePath = `${typedJob.asset.model?.id ?? "unknown"}/${jobId}.mp4`;
    await uploadEdited(outputPath, outputStoragePath);

    const outputStat = await stat(outputPath);

    await supabaseAdmin.from("video_job_outputs").insert({
      job_id: jobId,
      platform: typedJob.template.target_platform,
      resolution_width: targetResolution?.width ?? probe.width,
      resolution_height: targetResolution?.height ?? probe.height,
      file_path: outputStoragePath,
      file_size_bytes: outputStat.size,
      duration_seconds: probe.duration,
    });

    await supabaseAdmin
      .from("video_jobs")
      .update({
        status: "completed",
        progress: 100,
        finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);

    await logJob(jobId, "info", "Render completed", { outputPath: outputStoragePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job ${jobId} failed:`, message);

    const retryCount = typedJob?.retry_count ?? 0;
    const shouldRetry = retryCount < MAX_RETRIES;

    await supabaseAdmin
      .from("video_jobs")
      .update({
        status: shouldRetry ? "queued" : "failed",
        error_message: message,
        retry_count: retryCount + 1,
        finished_at: shouldRetry ? null : new Date().toISOString(),
      })
      .eq("id", jobId);

    await supabaseAdmin.from("video_processing_errors").insert({
      job_id: jobId,
      message,
      retryable: shouldRetry,
    });

    await logJob(jobId, "error", message, { retry: shouldRetry });
  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function getTargetResolution(template: {
  aspect: string;
  resolution_width: number | null;
  resolution_height: number | null;
}): { width: number; height: number } | null {
  if (template.resolution_width && template.resolution_height) {
    return { width: template.resolution_width, height: template.resolution_height };
  }

  switch (template.aspect) {
    case "vertical_9_16":
      return { width: 1080, height: 1920 };
    case "square_1_1":
      return { width: 1080, height: 1080 };
    case "portrait_4_5":
      return { width: 1080, height: 1350 };
    case "landscape_16_9":
      return { width: 1920, height: 1080 };
    case "original":
    default:
      return null;
  }
}

async function updateJobStatus(jobId: string, status: string) {
  const { error } = await supabaseAdmin
    .from("video_jobs")
    .update({ status })
    .eq("id", jobId);

  if (error) {
    console.error(`[worker] failed to update job ${jobId} to ${status}:`, error);
  }
}

async function logJob(
  jobId: string,
  level: "debug" | "info" | "warning" | "error",
  message: string,
  metadata?: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from("video_processing_logs").insert({
    job_id: jobId,
    level,
    message,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error(`[worker] failed to log job ${jobId}:`, error);
  }
}

main();
