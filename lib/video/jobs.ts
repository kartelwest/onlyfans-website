"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { videoJobActionSchema } from "@/lib/video/types";
import { z } from "zod";

const ORIGINALS_BUCKET = process.env.SUPABASE_VIDEO_ORIGINAIS_BUCKET ?? "video-originals";
const EDITED_BUCKET = process.env.SUPABASE_VIDEO_EDITADOS_BUCKET ?? "video-edited";
const MAX_UPLOAD_BYTES = Number(process.env.VIDEO_MAX_FILE_SIZE_MB ?? 2048) * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ["video/"];

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active || (profile.role !== "owner" && profile.role !== "administrator")) {
    throw new Error("Acesso negado. Apenas proprietários e administradores.");
  }

  return { supabase, user, profile };
}

export async function getVideoJobs() {
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from("video_jobs")
    .select(
      `
      id,
      status,
      progress,
      retry_count,
      cost_estimate,
      cost_actual,
      started_at,
      finished_at,
      error_message,
      created_at,
      updated_at,
      asset:asset_id (
        id,
        original_filename,
        mime_type,
        file_size_bytes,
        model:model_id (
          id,
          slug,
          display_name,
          stage_name
        )
      ),
      template:template_id (
        id,
        name,
        target_platform,
        aspect
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Erro ao carregar jobs: ${error.message}`);
  }

  return data ?? [];
}

export async function getVideoTemplates() {
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from("video_templates")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar templates: ${error.message}`);
  }

  return data ?? [];
}

export async function getModelsForVideo() {
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from("models")
    .select("id, slug, display_name, stage_name")
    .eq("active", true)
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar modelos: ${error.message}`);
  }

  return data ?? [];
}

export async function createVideoJob(formData: FormData) {
  const { supabase, user } = await requireStaff();

  const modelId = formData.get("modelId") as string;
  const templateId = formData.get("templateId") as string;
  const file = formData.get("file") as File | null;

  if (!modelId || !templateId || !file) {
    throw new Error("Modelo, template e arquivo são obrigatórios.");
  }

  const templateIdParse = z.string().uuid().safeParse(templateId);
  if (!templateIdParse.success) {
    throw new Error("Template inválido.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Arquivo excede o limite de ${process.env.VIDEO_MAX_FILE_SIZE_MB ?? 2048} MB.`);
  }

  if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    throw new Error("Tipo de arquivo não suportado. Envie um vídeo.");
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const safeExt = /^[a-z0-9]+$/.test(fileExt) ? fileExt : "mp4";

  // Verify template exists and model is authorized
  const { data: template, error: templateError } = await supabase
    .from("video_templates")
    .select("id")
    .eq("id", templateId)
    .single();

  if (templateError || !template) {
    throw new Error("Template não encontrado.");
  }

  const { data: model, error: modelError } = await supabase
    .from("models")
    .select("id")
    .eq("id", modelId)
    .single();

  if (modelError || !model) {
    throw new Error("Modelo não encontrado.");
  }

  // Create asset record first
  const { data: asset, error: assetError } = await supabase
    .from("video_assets")
    .insert({
      model_id: modelId,
      source_type: "manual_upload",
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      status: "pending",
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    throw new Error(`Erro ao registrar asset: ${assetError?.message ?? "desconhecido"}`);
  }

  const storagePath = `${modelId}/${asset.id}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Rollback asset record
    await supabase.from("video_assets").delete().eq("id", asset.id);
    throw new Error(`Erro no upload: ${uploadError.message}`);
  }

  // Update asset with storage path
  await supabase.from("video_assets").update({ storage_path: storagePath }).eq("id", asset.id);

  // Create job
  const { data: job, error: jobError } = await supabase
    .from("video_jobs")
    .insert({
      asset_id: asset.id,
      template_id: templateId,
      created_by: user.id,
      status: "new",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    await supabase.from("video_assets").delete().eq("id", asset.id);
    await supabase.storage.from(ORIGINALS_BUCKET).remove([storagePath]);
    throw new Error(`Erro ao criar job: ${jobError?.message ?? "desconhecido"}`);
  }

  // Optionally parse natural language instructions
  const naturalInstructions = formData.get("instructions") as string | null;
  if (naturalInstructions && naturalInstructions.trim().length > 0) {
    await supabase.from("video_instructions").insert({
      job_id: job.id,
      raw_text: naturalInstructions.trim(),
    });
  }

  revalidatePath("/admin/editor-de-video");

  return { success: true, jobId: job.id };
}

export async function approveVideoJob(raw: unknown) {
  const { supabase, user } = await requireStaff();
  const parsed = videoJobActionSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("Job inválido.");
  }

  const { jobId } = parsed.data;

  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, status")
    .eq("id", jobId)
    .single();

  if (!job) {
    throw new Error("Job não encontrado.");
  }

  if (job.status !== "new" && job.status !== "awaiting_approval" && job.status !== "failed") {
    throw new Error("Job não pode ser aprovado no status atual.");
  }

  await supabase.from("video_approvals").insert({
    job_id: jobId,
    approved_by: user.id,
    decision: "approved",
  });

  const { error } = await supabase
    .from("video_jobs")
    .update({ status: "queued", progress: 0, error_message: null, retry_count: 0 })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao aprovar job: ${error.message}`);
  }

  revalidatePath("/admin/editor-de-video");

  return { success: true };
}

export async function rejectVideoJob(raw: unknown) {
  const { supabase, user } = await requireStaff();
  const parsed = videoJobActionSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("Job inválido.");
  }

  const { jobId } = parsed.data;

  await supabase.from("video_approvals").insert({
    job_id: jobId,
    approved_by: user.id,
    decision: "rejected",
  });

  const { error } = await supabase
    .from("video_jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao rejeitar job: ${error.message}`);
  }

  revalidatePath("/admin/editor-de-video");

  return { success: true };
}

export async function reprocessVideoJob(raw: unknown) {
  const { supabase } = await requireStaff();
  const parsed = videoJobActionSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("Job inválido.");
  }

  const { jobId } = parsed.data;

  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: "queued",
      progress: 0,
      error_message: null,
      retry_count: 0,
      started_at: null,
      finished_at: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao reprocessar job: ${error.message}`);
  }

  revalidatePath("/admin/editor-de-video");

  return { success: true };
}

export async function getSignedVideoUrl(bucket: "originals" | "edited", path: string, expirySeconds = 300) {
  await requireStaff();

  const bucketName = bucket === "originals" ? ORIGINALS_BUCKET : EDITED_BUCKET;
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(path, expirySeconds);

  if (error) {
    throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
  }

  return data.signedUrl;
}

export async function createDefaultTemplates() {
  const { supabase, user } = await requireStaff();

  const templates = [
    {
      name: "Instagram Reels — Básico",
      description: "Corte vertical 9:16 com marca d'água e lower third.",
      target_platform: "instagram_reels",
      aspect: "vertical_9_16",
      resolution_width: 1080,
      resolution_height: 1920,
      settings: {
        outputFormat: "mp4",
        videoCodec: "libx264",
        audioCodec: "aac",
        watermark: {
          enabled: true,
          text: "KarayModels",
          position: "bottom_right",
          size: 60,
          opacity: 0.5,
        },
        lowerThird: {
          enabled: true,
          position: "bottom_left",
          fontSize: 28,
          fontColor: "#ffffff",
          backgroundColor: "#00000080",
        },
      },
      is_global: true,
      is_active: true,
      created_by: user.id,
    },
    {
      name: "OnlyFans Preview",
      description: "Preview sem branding explícito para OnlyFans.",
      target_platform: "onlyfans",
      aspect: "vertical_9_16",
      resolution_width: 1080,
      resolution_height: 1920,
      settings: {
        outputFormat: "mp4",
        videoCodec: "libx264",
        audioCodec: "aac",
        watermark: {
          enabled: false,
        },
        lowerThird: {
          enabled: false,
        },
      },
      is_global: true,
      is_active: true,
      created_by: user.id,
    },
  ];

  const { error } = await supabase.from("video_templates").insert(templates);

  if (error) {
    throw new Error(`Erro ao criar templates padrão: ${error.message}`);
  }

  revalidatePath("/admin/editor-de-video/templates");

  return { success: true };
}
