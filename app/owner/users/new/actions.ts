"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CreateUserState = {
  success: boolean;
  message: string;
  temporaryPassword?: string;
};

type UserRole = "model" | "administrator" | "representative";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function removeAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function createSlug(fullName: string) {
  const baseSlug = removeAccents(fullName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const uniqueSuffix = crypto.randomUUID().slice(0, 8);

  return `${baseSlug}-${uniqueSuffix}`;
}

function createModelPassword(fullName: string, whatsapp: string) {
  const nameParts = fullName.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];

  const cleanLastName = removeAccents(lastName).replace(
    /[^a-zA-Z0-9]/g,
    "",
  );

  const phoneDigits = normalizePhone(whatsapp);
  const lastFourDigits = phoneDigits.slice(-4);

  if (!cleanLastName || lastFourDigits.length !== 4) {
    return null;
  }

  return `${cleanLastName}${lastFourDigits}`;
}

export async function createUserAction(
  previousState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const fullName = String(formData.get("fullName") ?? "").trim();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const whatsapp = String(
    formData.get("whatsapp") ?? "",
  ).trim();

  const requestedPassword = String(
    formData.get("password") ?? "",
  ).trim();

  const role = String(
    formData.get("role") ?? "",
  ) as UserRole;

  if (
    role !== "model" &&
    role !== "administrator" &&
    role !== "representative"
  ) {
    return {
      success: false,
      message: "Tipo de conta inválido.",
    };
  }

  if (fullName.length < 3) {
    return {
      success: false,
      message: "Digite o nome completo.",
    };
  }

  if (!email.includes("@")) {
    return {
      success: false,
      message: "Digite um endereço de e-mail válido.",
    };
  }

  if (
    role === "model" &&
    normalizePhone(whatsapp).length < 8
  ) {
    return {
      success: false,
      message: "Digite um número de WhatsApp válido.",
    };
  }

  let password = requestedPassword;

  if (role === "model") {
    const generatedPassword = createModelPassword(
      fullName,
      whatsapp,
    );

    if (!generatedPassword) {
      return {
        success: false,
        message:
          "Não foi possível gerar a senha temporária da modelo.",
      };
    }

    password = generatedPassword;
  }

  if (password.length < 6) {
    return {
      success: false,
      message:
        "A senha deve ter pelo menos 6 caracteres.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message:
        "Sua sessão expirou. Entre novamente.",
    };
  }

  const {
    data: ownerProfile,
    error: ownerError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    ownerError ||
    !ownerProfile ||
    !ownerProfile.active ||
    ownerProfile.role !== "owner"
  ) {
    return {
      success: false,
      message:
        "Você não tem permissão para criar novas contas.",
    };
  }

  const adminSupabase = createAdminClient();

  const {
    data: createdUserData,
    error: createUserError,
  } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      whatsapp: role === "model" ? whatsapp : null,
    },
  });

  if (
    createUserError ||
    !createdUserData.user
  ) {
    return {
      success: false,
      message:
        createUserError?.message ??
        "Não foi possível criar a conta.",
    };
  }

  const createdUserId = createdUserData.user.id;

  const { error: profileError } =
    await adminSupabase
      .from("profiles")
      .insert({
        id: createdUserId,
        full_name: fullName,
        role,
        active: true,
      });

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(
      createdUserId,
    );

    return {
      success: false,
      message:
        `A conta não pôde ser concluída: ${profileError.message}`,
    };
  }

  if (role === "model") {
    const modelSlug = createSlug(fullName);

    const { error: modelError } =
      await adminSupabase
        .from("models")
        .insert({
          profile_id: createdUserId,
          display_name: fullName,
          slug: modelSlug,
          onboarding_complete: false,
          active: true,
          created_by: user.id,
        });

    if (modelError) {
      await adminSupabase
        .from("profiles")
        .delete()
        .eq("id", createdUserId);

      await adminSupabase.auth.admin.deleteUser(
        createdUserId,
      );

      return {
        success: false,
        message:
          `A conta da modelo não pôde ser concluída: ${modelError.message}`,
      };
    }
  }

  revalidatePath("/admin/models");
  revalidatePath("/owner/users");

  return {
    success: true,
    message: "Conta criada com sucesso.",
    temporaryPassword: password,
  };
}