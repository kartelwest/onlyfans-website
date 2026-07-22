import { NextResponse } from "next/server";

import {
  getAuthenticatedProfile,
  verifyModelAccess,
  requireStaff,
} from "@/lib/auth/model-access";
import { writeAuditLog } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

const allowedModelFields = {
  displayName: "display_name",
  stageName: "stage_name",
  birthday: "birthday",

  email: "email",
  whatsapp: "whatsapp",

  nationality: "nationality",
  city: "city",
  language: "language",

  instagram: "instagram",
  twitter: "twitter",
  reddit: "reddit",
  tiktok: "tiktok",
  youtube: "youtube",
  facebook: "facebook",

  onlyfans: "onlyfans",
  fansly: "fansly",

  driveOnlyfans: "drive_onlyfans",
  driveInstagram: "drive_instagram",
  driveTwitter: "drive_twitter",

  driveVideos: "drive_videos_url",
  drivePhotos: "drive_photos_url",
} as const;

type ModelEditableField =
  keyof typeof allowedModelFields;

type EditableField =
  | ModelEditableField
  | "fullName"
  | "profilePhotoUrl";

type Body = {
  modelId?: string;
  field?: EditableField;
  value?: string;
};

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (
    trimmed &&
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://")
  ) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export async function PATCH(
  request: Request,
) {
  try {
    const auth =
      await getAuthenticatedProfile();

    if (!auth.ok) {
      return auth.response;
    }

    const { profile } = auth;

    const body =
      (await request.json()) as Body;

    if (
      !body.modelId ||
      !body.field
    ) {
      return NextResponse.json(
        {
          error: "Dados inválidos.",
        },
        {
          status: 400,
        },
      );
    }

    const modelId = body.modelId;

    // Verify the caller has access to this model
    const access =
      await verifyModelAccess(
        modelId,
        profile,
      );

    if (!access.ok) {
      return access.response;
    }

    const normalizedValue =
      body.value?.trim() ?? "";

    // --- fullName: update both profiles.full_name AND models.display_name ---
    if (body.field === "fullName") {
      const staffCheck =
        await requireStaff(profile);

      if (!staffCheck.ok) {
        return staffCheck.response;
      }

      const supabase =
        await createClient();

      const {
        data: model,
        error: modelError,
      } = await supabase
        .from("models")
        .select(
          "profile_id, display_name",
        )
        .eq("id", modelId)
        .maybeSingle();

      if (modelError) {
        return NextResponse.json(
          {
            error: "Erro interno.",
          },
          {
            status: 500,
          },
        );
      }

      if (!model?.profile_id) {
        return NextResponse.json(
          {
            error:
              "Perfil da modelo não encontrado.",
          },
          {
            status: 404,
          },
        );
      }

      const {
        error: updateProfileError,
      } = await supabase
        .from("profiles")
        .update({
          full_name: normalizedValue,
        })
        .eq("id", model.profile_id);

      if (updateProfileError) {
        console.error(
          "Erro ao atualizar profiles.full_name:",
          updateProfileError,
        );
        return NextResponse.json(
          {
            error: "Erro interno.",
          },
          {
            status: 500,
          },
        );
      }

      const {
        error: updateModelError,
      } = await supabase
        .from("models")
        .update({
          display_name: normalizedValue,
        })
        .eq("id", modelId);

      if (updateModelError) {
        console.error(
          "Erro ao atualizar models.display_name:",
          updateModelError,
        );
        return NextResponse.json(
          {
            error: "Erro interno.",
          },
          {
            status: 500,
          },
        );
      }

      await writeAuditLog({
        modelId,
        actorId: profile.id,
        actorName: profile.fullName,
        actorRole: profile.role,
        field: "fullName",
        oldValue: model.display_name,
        newValue: normalizedValue,
      });

      return NextResponse.json({
        success: true,
      });
    }

    // --- profilePhotoUrl: owner/admin/rep can clear ---
    if (body.field === "profilePhotoUrl") {
      const supabase =
        await createClient();

      const {
        data: oldModel,
      } = await supabase
        .from("models")
        .select("profile_photo_url")
        .eq("id", modelId)
        .maybeSingle();

      const {
        error: updateError,
      } = await supabase
        .from("models")
        .update({
          profile_photo_url:
            normalizedValue || null,
        })
        .eq("id", modelId);

      if (updateError) {
        console.error(
          "Erro ao atualizar foto de perfil:",
          updateError,
        );
        return NextResponse.json(
          {
            error: "Erro interno.",
          },
          {
            status: 500,
          },
        );
      }

      await writeAuditLog({
        modelId,
        actorId: profile.id,
        actorName: profile.fullName,
        actorRole: profile.role,
        field: "profilePhotoUrl",
        oldValue:
          oldModel?.profile_photo_url ?? null,
        newValue: normalizedValue || null,
      });

      return NextResponse.json({
        success: true,
      });
    }

    // --- Regular model fields ---
    const dbField =
      allowedModelFields[
        body.field as ModelEditableField
      ];

    if (!dbField) {
      return NextResponse.json(
        {
          error: "Campo inválido.",
        },
        {
          status: 400,
        },
      );
    }

    // Drive URL fields: owner/admin only; normalize URL
    const isDriveUrlField =
      body.field === "driveVideos" ||
      body.field === "drivePhotos";

    if (isDriveUrlField) {
      const staffCheck =
        await requireStaff(profile);

      if (!staffCheck.ok) {
        return staffCheck.response;
      }
    }

    let valueToSave: string | null;

    if (
      body.field === "birthday" &&
      normalizedValue === ""
    ) {
      valueToSave = null;
    } else if (isDriveUrlField) {
      valueToSave =
        normalizeUrl(normalizedValue) || null;
    } else {
      valueToSave = normalizedValue;
    }

    const supabase =
      await createClient();

    const {
      data: oldModel,
    } = await supabase
      .from("models")
      .select(dbField)
      .eq("id", modelId)
      .maybeSingle();

    const oldModelRow =
      oldModel as Record<string, unknown> | null;

    const {
      error: updateModelError,
    } = await supabase
      .from("models")
      .update({
        [dbField]: valueToSave,
      })
      .eq("id", modelId);

    if (updateModelError) {
      console.error(
        "Erro ao atualizar modelo:",
        updateModelError,
      );
      return NextResponse.json(
        {
          error: "Erro interno.",
        },
        {
          status: 500,
        },
      );
    }

    await writeAuditLog({
      modelId,
      actorId: profile.id,
      actorName: profile.fullName,
      actorRole: profile.role,
      field: body.field,
      oldValue:
        oldModelRow?.[dbField] != null
          ? String(oldModelRow[dbField])
          : null,
      newValue: valueToSave,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar modelo:",
      error,
    );

    return NextResponse.json(
      {
        error: "Erro interno.",
      },
      {
        status: 500,
      },
    );
  }
}