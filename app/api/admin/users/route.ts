import { NextResponse } from "next/server";

import {
  generateTemporaryPassword,
  normalizeDateOfBirth,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeCountry,
} from "@/lib/admin/modelOnboardingHelpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureOnlyFansEnrollmentForModel } from "@/lib/brand/talent";
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
  draftModelId?: string;
  originalText?: string;
};

const ALLOWED_CREATION_ROLES: ManagementRole[] = [
  "model",
  "representative",
  "administrator",
];

export async function POST(request: Request) {
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
          error: "Você precisa estar conectado.",
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
          error: "Seu perfil não está ativo.",
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
            "Você não tem permissão para criar usuários.",
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
          error: "Tipo de usuário inválido.",
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
            "Somente o proprietário pode criar administradores.",
        },
        {
          status: 403,
        },
      );
    }

    if (!fullName) {
      return NextResponse.json(
        {
          error: "Informe o nome completo.",
        },
        {
          status: 400,
        },
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: "Informe o e-mail.",
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
              "Informe um número de WhatsApp válido com pelo menos 8 dígitos.",
          },
          { status: 400 },
        );
      }

      if (!emailResult.valid) {
        return NextResponse.json(
          { error: "Informe um endereço de e-mail válido." },
          { status: 400 },
        );
      }
    }

    const adminSupabase = createAdminClient();

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
          { error: "Rascunho não encontrado ou já foi convertido." },
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
          { error: "Já existe uma modelo cadastrada com este e-mail." },
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
            { error: "Já existe uma modelo cadastrada com este WhatsApp." },
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
            "A senha temporária deve ter pelo menos 8 caracteres.",
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
      email,
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
        "Não foi possível criar o acesso do usuário.";

      if (
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("registered")
      ) {
        return NextResponse.json(
          {
            error:
              "Já existe um usuário cadastrado com este e-mail.",
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
        must_change_password: role === "model" ? true : false,
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
            "Erro ao sincronizar matrícula OnlyFans:",
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
              author_id: currentProfile.id,
              author_name: currentProfile.full_name,
              author_role: currentProfile.role,
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

    return NextResponse.json(
      {
        success: true,
        message: "Usuário criado com sucesso.",
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
            : "Ocorreu um erro inesperado.",
      },
      {
        status: 500,
      },
    );
  }
}
