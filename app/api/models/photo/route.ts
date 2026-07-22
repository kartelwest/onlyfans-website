import { NextResponse } from "next/server";

import {
  getAuthenticatedProfile,
  verifyModelAccess,
} from "@/lib/auth/model-access";
import { writeAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedProfile();

    if (!auth.ok) {
      return auth.response;
    }

    const { profile } = auth;

    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const modelId = formData.get("modelId") as string | null;

    if (!modelId) {
      return NextResponse.json(
        { error: "O ID da modelo é obrigatório." },
        { status: 400 },
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de imagem inválido. Use JPG, PNG, WebP ou GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "A imagem não pode ultrapassar 10 MB." },
        { status: 400 },
      );
    }

    // Verify the caller has access to this model
    const access = await verifyModelAccess(modelId, profile);

    if (!access.ok) {
      return access.response;
    }

    // Get the old photo URL for cleanup
    const supabase = await createClient();

    const { data: model } = await supabase
      .from("models")
      .select("profile_photo_url")
      .eq("id", modelId)
      .maybeSingle();

    const oldPhotoUrl = model?.profile_photo_url ?? null;

    // Upload to Supabase Storage using admin client (bypasses RLS for upload)
    const admin = createAdminClient();

    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${modelId}/${crypto.randomUUID()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await admin.storage
      .from("model-avatars")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erro ao fazer upload da foto:", uploadError);
      return NextResponse.json(
        { error: "Erro ao fazer upload da imagem." },
        { status: 500 },
      );
    }

    // Get the public URL
    const { data: publicUrlData } = admin.storage
      .from("model-avatars")
      .getPublicUrl(filePath);

    const photoUrl = publicUrlData.publicUrl;

    // Update the model record
    const { error: updateError } = await supabase
      .from("models")
      .update({ profile_photo_url: photoUrl })
      .eq("id", modelId);

    if (updateError) {
      console.error("Erro ao salvar URL da foto:", updateError);
      // Try to clean up the uploaded file
      await admin.storage.from("model-avatars").remove([filePath]);
      return NextResponse.json(
        { error: "Erro ao salvar a foto de perfil." },
        { status: 500 },
      );
    }

    // Clean up old photo if it existed and is from our bucket
    if (oldPhotoUrl && oldPhotoUrl.includes("model-avatars")) {
      try {
        const oldPath = oldPhotoUrl.split("/model-avatars/")[1];
        if (oldPath) {
          await admin.storage.from("model-avatars").remove([oldPath]);
        }
      } catch {
        // Non-critical: old file may already be gone
      }
    }

    await writeAuditLog({
      modelId,
      actorId: profile.id,
      actorName: profile.fullName,
      actorRole: profile.role,
      field: "profilePhotoUrl",
      oldValue: oldPhotoUrl,
      newValue: photoUrl,
    });

    return NextResponse.json({
      success: true,
      photoUrl,
    });
  } catch (error) {
    console.error("Erro no upload da foto:", error);
    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedProfile();

    if (!auth.ok) {
      return auth.response;
    }

    const { profile } = auth;

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        { error: "O ID da modelo é obrigatório." },
        { status: 400 },
      );
    }

    const access = await verifyModelAccess(modelId, profile);

    if (!access.ok) {
      return access.response;
    }

    const supabase = await createClient();

    const { data: model } = await supabase
      .from("models")
      .select("profile_photo_url")
      .eq("id", modelId)
      .maybeSingle();

    const oldPhotoUrl = model?.profile_photo_url ?? null;

    // Clear the URL in the database
    const { error: updateError } = await supabase
      .from("models")
      .update({ profile_photo_url: null })
      .eq("id", modelId);

    if (updateError) {
      console.error("Erro ao remover foto:", updateError);
      return NextResponse.json(
        { error: "Erro ao remover a foto." },
        { status: 500 },
      );
    }

    // Remove the file from storage
    if (oldPhotoUrl && oldPhotoUrl.includes("model-avatars")) {
      try {
        const admin = createAdminClient();
        const oldPath = oldPhotoUrl.split("/model-avatars/")[1];
        if (oldPath) {
          await admin.storage.from("model-avatars").remove([oldPath]);
        }
      } catch {
        // Non-critical
      }
    }

    await writeAuditLog({
      modelId,
      actorId: profile.id,
      actorName: profile.fullName,
      actorRole: profile.role,
      field: "profilePhotoUrl",
      oldValue: oldPhotoUrl,
      newValue: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover foto:", error);
    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 },
    );
  }
}
