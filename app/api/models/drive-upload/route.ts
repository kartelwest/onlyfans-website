import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import {
  extractDriveFolderId,
  isDriveUploadConfigured,
  uploadFileToDriveFolder,
} from "@/lib/googleDrive";

import type { ManagementRole } from "@/types/model";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// This is the rep's ONE permitted write action anywhere in the Model
// Dashboard (Section 7 — "Enviar conteúdo para o Drive"). It is also
// available to the model herself and to staff. Every other write path in the
// dashboard is staff-only.
export async function POST(request: Request) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.driveUpload");
  try {
    if (!isDriveUploadConfigured()) {
      return NextResponse.json(
        {
          error:
            tRoute("notConfigured"),
        },
        { status: 503 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: t("notAuthenticated") },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: t("invalidProfile") },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    const formData = await request.formData();
    const modelId = formData.get("modelId");
    const file = formData.get("file") as File | null;

    if (!modelId || typeof modelId !== "string") {
      return NextResponse.json(
        { error: t("modelIdMissing") },
        { status: 400 },
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: tRoute("fileRequired") },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: tRoute("fileTooLarge") },
        { status: 400 },
      );
    }

    // RLS already scopes this select to rows the caller may read (staff, the
    // assigned representative, or the model's own row) — an unauthorized
    // caller simply gets no row back.
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id, profile_id, representative_id, content_drive_url")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError || !model) {
      return NextResponse.json(
        { error: tRoute("modelNotFoundOrDenied") },
        { status: 404 },
      );
    }

    const isStaff = role === "owner" || role === "administrator";
    const isAssignedRep =
      role === "representative" && model.representative_id === user.id;
    const isOwnModel = role === "model" && model.profile_id === user.id;

    if (!isStaff && !isAssignedRep && !isOwnModel) {
      return NextResponse.json(
        { error: t("noPermission") },
        { status: 403 },
      );
    }

    if (!model.content_drive_url) {
      return NextResponse.json(
        {
          error:
            tRoute("folderNotConfigured"),
        },
        { status: 409 },
      );
    }

    const folderId = extractDriveFolderId(model.content_drive_url);

    if (!folderId) {
      return NextResponse.json(
        { error: tRoute("invalidFolderLink") },
        { status: 422 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await uploadFileToDriveFolder(folderId, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    return NextResponse.json({
      success: true,
      fileId: uploaded.id,
      webViewLink: uploaded.webViewLink,
    });
  } catch (error) {
    console.error("Failed to upload content to Google Drive:", error);

    return NextResponse.json(
      { error: tRoute("uploadFailed") },
      { status: 500 },
    );
  }
}
