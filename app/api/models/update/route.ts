import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logAuditEntry, getFieldLabel } from "@/lib/audit/auditLogger";
import { isCountryCode } from "@/lib/countries";
import { normalizeCurrencyCode } from "@/lib/money/currency";

import type { ManagementRole } from "@/types/model";

const allowedModelFields = {
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
  contentDriveUrl: "content_drive_url",

  preferredCurrency: "preferred_currency",
  countryCode: "country_code",
  contentFrequency: "content_frequency",
  referralSource: "referral_source",
} as const;

const allowedBooleanModelFields = {
  blockBrazil: "block_brazil",
  showFace: "show_face",
} as const;

type ModelEditableField =
  keyof typeof allowedModelFields;

type ModelBooleanEditableField =
  keyof typeof allowedBooleanModelFields;

type EditableField =
  | ModelEditableField
  | ModelBooleanEditableField
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
      .select("id, full_name, role, active")
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

    if (body.field === "fullName") {
      if (!normalizedValue) {
        return NextResponse.json({
          success: true,
        });
      }

      const {
        data: model,
        error: modelError,
      } = await supabase
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
        data: existingProfile,
      } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", model.profile_id)
        .maybeSingle();

      const {
        error: updateProfileError,
      } = await supabase
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

      await logAuditEntry(supabase, {
        modelId: body.modelId,
        action: "field_update",
        fieldName: "full_name",
        previousValue: existingProfile?.full_name ?? null,
        newValue: normalizedValue,
        actor: {
          id: profile.id,
          fullName: profile.full_name || "Usuário",
          role,
        },
        source: "api:/api/models/update",
        summary: `${getFieldLabel("full_name")} alterado(a) de "${existingProfile?.full_name ?? "—"}" para "${normalizedValue}"`,
      });

      return NextResponse.json({
        success: true,
      });
    }

    if (
      body.field in allowedBooleanModelFields
    ) {
      const booleanDbField =
        allowedBooleanModelFields[
          body.field as ModelBooleanEditableField
        ];

      const {
        data: existingModel,
      } = await supabase
        .from("models")
        .select(booleanDbField)
        .eq("id", body.modelId)
        .maybeSingle();

      const previousBooleanValue =
        (existingModel as Record<string, unknown> | null)?.[booleanDbField];
      const newBooleanValue = body.value === "true";

      const {
        error: updateBooleanError,
      } = await supabase
        .from("models")
        .update({
          [booleanDbField]: newBooleanValue,
        })
        .eq("id", body.modelId);

      if (updateBooleanError) {
        return NextResponse.json(
          {
            error:
              updateBooleanError.message,
          },
          {
            status: 500,
          },
        );
      }

      await logAuditEntry(supabase, {
        modelId: body.modelId,
        action: "field_update",
        fieldName: booleanDbField,
        previousValue: previousBooleanValue != null ? String(previousBooleanValue) : null,
        newValue: String(newBooleanValue),
        actor: {
          id: profile.id,
          fullName: profile.full_name || "Usuário",
          role,
        },
        source: "api:/api/models/update",
        summary: `${getFieldLabel(booleanDbField)} alterado(a) de "${previousBooleanValue ?? "—"}" para "${newBooleanValue}"`,
      });

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

    // country_code and preferred_currency are codes, not prose: they feed
    // Intl (flag emoji, currency symbol) and a CHECK constraint, so they are
    // normalized and validated here rather than stored as typed.
    if (dbField === "country_code" && normalizedValue !== "") {
      if (!isCountryCode(normalizedValue.toUpperCase())) {
        return NextResponse.json(
          { error: "País inválido." },
          { status: 400 },
        );
      }
    }

    if (dbField === "preferred_currency" && normalizedValue !== "") {
      if (!normalizeCurrencyCode(normalizedValue)) {
        return NextResponse.json(
          { error: "Moeda inválida. Use um código ISO 4217, como BRL ou USD." },
          { status: 400 },
        );
      }
    }

    const codeValue =
      dbField === "country_code"
        ? normalizedValue.toUpperCase()
        : dbField === "preferred_currency"
          ? normalizeCurrencyCode(normalizedValue)
          : normalizedValue;

    const valueToSave =
      normalizedValue === "" &&
      (body.field === "birthday" ||
        dbField === "country_code" ||
        dbField === "preferred_currency")
        ? null
        : codeValue;

    const {
      data: existingModel,
    } = await supabase
      .from("models")
      .select(dbField)
      .eq("id", body.modelId)
      .maybeSingle();

    const previousFieldValue =
      (existingModel as Record<string, unknown> | null)?.[dbField];

    const {
      error: updateModelError,
    } = await supabase
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

    await logAuditEntry(supabase, {
      modelId: body.modelId,
      action: "field_update",
      fieldName: dbField,
      previousValue: previousFieldValue != null ? String(previousFieldValue) : null,
      newValue: valueToSave ?? null,
      actor: {
        id: profile.id,
        fullName: profile.full_name || "Usuário",
        role,
      },
      source: "api:/api/models/update",
      summary: `${getFieldLabel(dbField)} alterado(a) de "${previousFieldValue ?? "—"}" para "${valueToSave ?? "—"}"`,
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