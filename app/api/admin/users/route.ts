import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
};

const ALLOWED_CREATION_ROLES: ManagementRole[] = [
  "model",
  "representative",
  "administrator",
];

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null;

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
        .select("id, role, active")
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
    const fullName = body.fullName?.trim();
    const stageName = body.stageName?.trim() || null;
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || null;
    const dateOfBirth = body.dateOfBirth || null;
    const country = body.country?.trim() || null;
    const temporaryPassword =
      body.temporaryPassword || "";
    const active = body.active ?? true;
    const websiteLoginEnabled =
      body.websiteLoginEnabled ?? true;

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

    const adminSupabase = createAdminClient();

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
      const slug = await createUniqueModelSlug(
        adminSupabase,
        stageName || fullName,
      );

      const modelNumber =
        await getNextModelNumber(adminSupabase);

      const { error: createModelError } =
        await adminSupabase.from("models").insert({
          profile_id: createdAuthUserId,
          model_number: modelNumber,
          slug,
          display_name: stageName || fullName,
          full_name: fullName,
          stage_name: stageName,
          birthday: dateOfBirth,
          nationality: country,
          email,
          whatsapp: phone,
          status: active ? "active" : "inactive",
          active,
          website_login_enabled:
            websiteLoginEnabled,
        });

      if (createModelError) {
        await adminSupabase
          .from("profiles")
          .delete()
          .eq("id", createdAuthUserId);

        await adminSupabase.auth.admin.deleteUser(
          createdAuthUserId,
        );

        createdAuthUserId = null;

        return NextResponse.json(
          {
            error: `O acesso foi criado, mas o cadastro da modelo não pôde ser salvo: ${createModelError.message}`,
          },
          {
            status: 500,
          },
        );
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

    if (createdAuthUserId) {
      try {
        const adminSupabase = createAdminClient();

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

async function getNextModelNumber(
  adminSupabase: ReturnType<
    typeof createAdminClient
  >,
) {
  const { data, error } = await adminSupabase
    .from("models")
    .select("model_number")
    .not("model_number", "is", null)
    .order("model_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível gerar o número da modelo: ${error.message}`,
    );
  }

  return (data?.model_number ?? 0) + 1;
}

async function createUniqueModelSlug(
  adminSupabase: ReturnType<
    typeof createAdminClient
  >,
  name: string,
) {
  const baseSlug =
    createSlug(name) || `modelo-${Date.now()}`;

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await adminSupabase
      .from("models")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Não foi possível verificar o endereço da modelo: ${error.message}`,
      );
    }

    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}