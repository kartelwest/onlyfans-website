import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAuditEntry } from "@/lib/audit/auditLogger";

import type { ManagementRole } from "@/types/model";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Avatar is the ONE field a model may edit about herself. A representative
// may never edit it — her only write capability anywhere in the dashboard is
// the Google Drive content upload (see /api/models/drive-upload).
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: "Perfil inválido." },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    if (role !== "owner" && role !== "administrator" && role !== "model") {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const modelId = formData.get("modelId");
    const file = formData.get("file") as File | null;

    if (!modelId || typeof modelId !== "string") {
      return NextResponse.json(
        { error: "Identificação da modelo não informada." },
        { status: 400 },
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo obrigatório." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 5MB." },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido." },
        { status: 400 },
      );
    }

    const { data: existingModel } = await supabase
      .from("models")
      .select("profile_photo_url")
      .eq("id", modelId)
      .maybeSingle();

    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id, profile_id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError || !model) {
      return NextResponse.json(
        { error: "Modelo não encontrada." },
        { status: 404 },
      );
    }

    const isStaff = role === "owner" || role === "administrator";
    const isOwnModel = role === "model" && model.profile_id === user.id;

    if (!isStaff && !isOwnModel) {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 },
      );
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";
    const path = `${modelId}/${crypto.randomUUID()}.${extension}`;

    const admin = createAdminClient();

    const upload = await admin.storage
      .from("model-avatars")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (upload.error) {
      console.error("Erro ao fazer upload do avatar:", upload.error);
      return NextResponse.json(
        { error: "Erro ao fazer upload do avatar." },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = admin.storage
      .from("model-avatars")
      .getPublicUrl(path);

    const { error: updateError } = await admin
      .from("models")
      .update({ profile_photo_url: publicUrlData.publicUrl })
      .eq("id", modelId);

    if (updateError) {
      await admin.storage.from("model-avatars").remove([path]);
      console.error("Erro ao salvar avatar:", updateError);
      return NextResponse.json(
        { error: "Erro ao salvar avatar." },
        { status: 500 },
      );
    }

    await logAuditEntry(supabase, {
      modelId,
      action: "avatar_update",
      fieldName: "profile_photo_url",
      previousValue: existingModel?.profile_photo_url ?? null,
      newValue: publicUrlData.publicUrl,
      actor: {
        id: profile.id,
        fullName: profile.full_name || "Usuário",
        role,
      },
      source: "api:/api/models/avatar",
      summary: "Foto de perfil atualizada",
    });

    return NextResponse.json({
      success: true,
      profilePhotoUrl: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error("Erro ao atualizar avatar:", error);

    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 },
    );
  }
}
