import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { ManagementRole } from "@/types/model";

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
} as const;

type ModelEditableField =
  keyof typeof allowedModelFields;

type EditableField =
  | ModelEditableField
  | "fullName";

type Body = {
  modelId?: string;
  field?: EditableField;
  value?: string;
};

export async function PATCH(
  request: Request,
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.active
    ) {
      return NextResponse.json(
        {
          error: "Perfil inválido.",
        },
        {
          status: 403,
        },
      );
    }

    const role =
      profile.role as ManagementRole;

    if (
      role !== "owner" &&
      role !== "administrator"
    ) {
      return NextResponse.json(
        {
          error: "Sem permissão.",
        },
        {
          status: 403,
        },
      );
    }

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

    const normalizedValue =
      body.value?.trim() ?? "";

    const admin =
      createAdminClient();

    if (body.field === "fullName") {
      const {
        data: model,
        error: modelError,
      } = await admin
        .from("models")
        .select("profile_id")
        .eq("id", body.modelId)
        .maybeSingle();

      if (modelError) {
        return NextResponse.json(
          {
            error: modelError.message,
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
      } = await admin
        .from("profiles")
        .update({
          full_name: normalizedValue,
        })
        .eq("id", model.profile_id);

      if (updateProfileError) {
        return NextResponse.json(
          {
            error:
              updateProfileError.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

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

    const valueToSave =
      body.field === "birthday" &&
      normalizedValue === ""
        ? null
        : normalizedValue;

    const {
      error: updateModelError,
    } = await admin
      .from("models")
      .update({
        [dbField]: valueToSave,
      })
      .eq("id", body.modelId);

    if (updateModelError) {
      return NextResponse.json(
        {
          error:
            updateModelError.message,
        },
        {
          status: 500,
        },
      );
    }

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