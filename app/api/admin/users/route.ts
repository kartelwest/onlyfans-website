import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  generateTemporaryPassword,
  normalizeDateOfBirth,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeCountry,
} from "@/lib/admin/modelOnboardingHelpers";
import {
  resolveLoginIdentifier,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/loginIdentifier";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureOnlyFansEnrollmentForModel } from "@/lib/brand/talent";
import { logAuditEntry } from "@/lib/audit/auditLogger";
import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

type CreateUserRequest = {
  role?: ManagementRole;
  fullName?: string;
  stageName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  country?: string;
  temporaryPassword?: string;
  active?: boolean;
  websiteLoginEnabled?: boolean;
  representativeId?: string;
  draftModelId?: string;
  originalText?: string;
};

const ALLOWED_CREATION_ROLES: ManagementRole[] = [
  "model",
  "representative",
  "administrator",
];

export async function POST(request: Request) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.adminUsers");
  let createdAuthUserId: string | null = null;
  let createdModelId: string | null = null;
  let isNewModel = false;

  try {
    const supabase = await createClient();

    const {
      data: { user: currentUser },
      error: currentUserError,
    } = await supabase.auth.getUser();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        {
          error: t("mustBeSignedIn"),
        },
        {
          status: 401,
        },
      );
    }

    const { data: currentProfile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, role, active, full_name")
        .eq("id", currentUser.id)
        .single();

    if (
      profileError ||
      !currentProfile ||
      !currentProfile.active
    ) {
      return NextResponse.json(
        {
          error: t("profileInactive"),
        },
        {
          status: 403,
        },
      );
    }

    const currentUserRole =
      currentProfile.role as ManagementRole;

    if (
      currentUserRole !== "owner" &&
      currentUserRole !== "administrator"
    ) {
      return NextResponse.json(
        {
          error:
            tRoute("notPermitted"),
        },
        {
          status: 403,
        },
      );
    }

    const body =
      (await request.json()) as CreateUserRequest;

    const role = body.role;
    const fullName = normalizeName(body.fullName);
    const stageName = normalizeName(body.stageName);
    const emailResult = normalizeEmail(body.email);
    const email = emailResult.value;
    const phoneResult = normalizePhone(body.phone);
    const phone = phoneResult.normalized;
    const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth ?? "").value;
    const country = normalizeCountry(body.country);
    const active = body.active ?? true;
    const websiteLoginEnabled =
      body.websiteLoginEnabled ?? true;
    const draftModelId =
      typeof body.draftModelId === "string" && body.draftModelId
        ? body.draftModelId
        : null;

    if (
      !role ||
      !ALLOWED_CREATION_ROLES.includes(role)
    ) {
      return NextResponse.json(
        {
          error: tRoute("invalidRole"),
        },
        {
          status: 400,
        },
      );
    }

    if (
      role === "administrator" &&
      currentUserRole !== "owner"
    ) {
      return NextResponse.json(
        {
          error:
            tRoute("ownerOnlyAdmins"),
        },
        {
          status: 403,
        },
      );
    }

    if (!fullName) {
      return NextResponse.json(
        {
          error: tRoute("fullNameRequired"),
        },
        {
          status: 400,
        },
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: tRoute("emailRequired"),
        },
        {
          status: 400,
        },
      );
    }

    if (role === "model") {
      if (!phoneResult.valid) {
        return NextResponse.json(
          {
            error:
              tRoute("invalidWhatsapp"),
          },
          { status: 400 },
        );
      }

      if (!emailResult.valid) {
        return NextResponse.json(
          { error: t("invalidEmail") },
          { status: 400 },
        );
      }
    }

    // A representative or an administrator may be given a bare username instead
    // of an address — the same rule a model's login already follows. Supabase
    // authenticates by e-mail only, so a username is registered under the
    // reserved login domain and the person types just the username.
    //
    // `loginEmail` is what Supabase Auth registers; `contactEmail` is the
    // address written to the profile, and stays null for a username, because a
    // synthetic address is not somewhere anyone can be reached.
    let loginEmail = email;
    let contactEmail: string | null = emailResult.valid ? email : null;

    if (role !== "model") {
      const resolved = resolveLoginIdentifier(email);

      if (!resolved.ok) {
        return NextResponse.json(
          {
            error:
              resolved.reason === "invalid_email"
                ? t("invalidEmail")
                : `O nome de usuário deve ter de ${USERNAME_MIN_LENGTH} a ${USERNAME_MAX_LENGTH} caracteres e usar apenas letras, números, ponto, hífen ou sublinhado.`,
          },
          { status: 400 },
        );
      }

      loginEmail = resolved.email;
      contactEmail = resolved.username ? null : resolved.email;
    }

    const adminSupabase = createAdminClient();

    let assignedRepresentativeId: string | null = null;

    if (role === "model") {
      const representativeId = body.representativeId?.trim();
      assignedRepresentativeId = representativeId || currentProfile.id;

      const { data: representative } = await adminSupabase
        .from("profiles")
        .select("id, role, active, status")
        .eq("id", assignedRepresentativeId)
        .in("role", ["owner", "administrator", "representative"])
        .maybeSingle();

      if (!representative || !representative.active) {
        return NextResponse.json(
          { error: tRoute("representativeInactive") },
          { status: 400 },
        );
      }

      if (
        representative.role === "representative" &&
        representative.status !== "ativa"
      ) {
        return NextResponse.json(
          { error: tRoute("representativeInactive") },
          { status: 400 },
        );
      }
    }

    let existingDraft:
      | { id: string; slug: string; model_number: number | null }
      | null = null;

    if (draftModelId && role === "model") {
      const { data, error } = await adminSupabase
        .from("models")
        .select("id, slug, model_number, profile_id, email, whatsapp")
        .eq("id", draftModelId)
        .is("profile_id", null)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: tRoute("draftNotFound") },
          { status: 404 },
        );
      }

      existingDraft = data;
    }

    if (role === "model") {
      const duplicateEmail = await adminSupabase
        .from("models")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .neq("id", existingDraft?.id || "00000000-0000-0000-0000-000000000000");

      if (!duplicateEmail.error && (duplicateEmail.count ?? 0) > 0) {
        return NextResponse.json(
          { error: tRoute("emailTaken") },
          { status: 409 },
        );
      }

      if (phoneResult.normalized) {
        const duplicateWhatsApp = await adminSupabase
          .from("models")
          .select("id", { count: "exact", head: true })
          .eq("whatsapp", phoneResult.normalized)
          .neq("id", existingDraft?.id || "00000000-0000-0000-0000-000000000000");

        if (!duplicateWhatsApp.error && (duplicateWhatsApp.count ?? 0) > 0) {
          return NextResponse.json(
            { error: tRoute("whatsappTaken") },
            { status: 409 },
          );
        }
      }
    }

    let temporaryPassword = body.temporaryPassword || "";

    if (role === "model" && phoneResult.digits) {
      temporaryPassword = generateTemporaryPassword(phoneResult.digits);
    }

    if (temporaryPassword.length < 8) {
      return NextResponse.json(
        {
          error:
            tRoute("passwordTooShort"),
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: createdAuthData,
      error: createAuthError,
    } = await adminSupabase.auth.admin.createUser({
      email: loginEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
      app_metadata: {
        role,
      },
    });

    if (
      createAuthError ||
      !createdAuthData.user
    ) {
      const message =
        createAuthError?.message ||
        tRoute("createAccessFailed");

      if (
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("registered")
      ) {
        return NextResponse.json(
          {
            error:
              tRoute("userEmailTaken"),
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          error: message,
        },
        {
          status: 400,
        },
      );
    }

    createdAuthUserId = createdAuthData.user.id;

    const { error: createProfileError } =
      await adminSupabase.from("profiles").insert({
        id: createdAuthUserId,
        full_name: fullName,
        role,
        active,
        // The profile carries the contact address so the representative and
        // administrator lists have something to show; a username-only account
        // leaves it null rather than displaying an internal synthetic address.
        email: contactEmail,
        // Anyone handed a password by somebody else replaces it at first
        // login. That has always applied to a model; a representative is given
        // her password the same way, so it applies to her too.
        must_change_password: role === "model" || role === "representative",
      });

    if (createProfileError) {
      await adminSupabase.auth.admin.deleteUser(
        createdAuthUserId,
      );

      createdAuthUserId = null;

      return NextResponse.json(
        {
          error: `O acesso foi criado, mas o perfil não pôde ser salvo: ${createProfileError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (role === "model") {
      const effectiveStageName = stageName || fullName || "";

      const slug = existingDraft
        ? existingDraft.slug
        : await createUniqueModelSlug(adminSupabase, effectiveStageName);

      const modelNumber = existingDraft
        ? existingDraft.model_number
        : await getNextModelNumber(adminSupabase);

      const modelPayload = {
        profile_id: createdAuthUserId,
        model_number: modelNumber,
        slug,
        display_name: fullName,
        stage_name: effectiveStageName,
        birthday: dateOfBirth,
        nationality: country,
        email,
        whatsapp: phone,
        representative_id: assignedRepresentativeId,
        representative_changed_by: currentProfile.id,
        representative_changed_at: new Date().toISOString(),
        status: active ? "active" as const : "inactive" as const,
        active,
        website_login_enabled: websiteLoginEnabled,
        created_by: currentProfile.id,
      };

      let createdModel;

      if (existingDraft) {
        const { data, error: updateModelError } = await adminSupabase
          .from("models")
          .update(modelPayload)
          .eq("id", existingDraft.id)
          .select("id")
          .single();

        if (updateModelError) {
          throw new Error(updateModelError.message);
        }

        createdModel = data;
      } else {
        const { data, error: createModelError } = await adminSupabase
          .from("models")
          .insert(modelPayload)
          .select("id")
          .single();

        if (createModelError) {
          throw new Error(createModelError.message);
        }

        createdModel = data;
        isNewModel = true;
      }

      if (createdModel) {
        createdModelId = createdModel.id;

        const enrollmentResult = await ensureOnlyFansEnrollmentForModel(
          createdModel.id,
        );

        if (enrollmentResult.error) {
          console.error(
            "Failed to sync the OnlyFans enrollment:",
            enrollmentResult.error,
          );
        }
      }

      const originalText =
        typeof body.originalText === "string" ? body.originalText.trim() : "";

      if (createdModel && originalText) {
        const { count: existingNoteCount } = await adminSupabase
          .from("model_notes")
          .select("*", { count: "exact", head: true })
          .eq("model_id", createdModel.id)
          .eq("body", originalText)
          .eq("created_by", currentProfile.id);

        if (!existingNoteCount) {
          const { error: noteError } = await adminSupabase
            .from("model_notes")
            .insert({
              model_id: createdModel.id,
              body: originalText,
              priority: "normal",
              pinned: false,
              archived: false,
              created_by: currentProfile.id,
              created_by_name: currentProfile.full_name,
              created_by_role: currentProfile.role,
              updated_by: currentProfile.id,
              updated_by_name: currentProfile.full_name,
              updated_by_role: currentProfile.role,
            });

          if (noteError) {
            console.error("Erro ao salvar nota do texto original:", noteError);
          }
        }
      }
    }

    if (createdModelId && role === "model") {
      await logAuditEntry(supabase, {
        modelId: createdModelId,
        action: "model_created",
        fieldName: null,
        previousValue: null,
        newValue: fullName,
        actor: {
          id: currentProfile.id,
          fullName: currentProfile.full_name || "Usuário",
          role: currentUserRole,
        },
        source: "api:/api/admin/users",
        summary: `Modelo "${fullName}" criada (${existingDraft ? "a partir de rascunho" : "nova"})`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: tRoute("created"),
        user: {
          id: createdAuthUserId,
          email,
          fullName,
          role,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao criar usuário:",
      error,
    );

    if (createdAuthUserId && (!createdModelId || isNewModel)) {
      try {
        const adminSupabase = createAdminClient();

        if (createdModelId && isNewModel) {
          await adminSupabase
            .from("model_notes")
            .delete()
            .eq("model_id", createdModelId);

          await adminSupabase
            .from("models")
            .delete()
            .eq("id", createdModelId);
        }

        await adminSupabase
          .from("profiles")
          .delete()
          .eq("id", createdAuthUserId);

        await adminSupabase.auth.admin.deleteUser(
          createdAuthUserId,
        );
      } catch (cleanupError) {
        console.error(
          "Erro ao desfazer criação do usuário:",
          cleanupError,
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : t("unexpected"),
      },
      {
        status: 500,
      },
    );
  }
}
