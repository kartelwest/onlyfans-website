import { NextResponse } from "next/server";

import {
  describeLogin,
  looksLikeEmail,
  resolveLoginIdentifier,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/loginIdentifier";
import { logAuditEntry } from "@/lib/audit/auditLogger";
import { formatBrazilDateTime } from "@/lib/models/formatDateTime";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

// Matches the rule already enforced when creating a user
// (app/api/admin/users/route.ts) and when a model changes her own password
// (app/alterar-senha/page.tsx).
const MIN_PASSWORD_LENGTH = 8;

// Same shape as the "NOVO CANDIDATO" header written by the applicant intake
// (lib/models/applicantIntake.ts): `HEADER — [dd/MM/yyyy HH:mm]`, then
// `Rótulo — valor` lines.
const AUDIT_NOTE_HEADER = "ALTERAÇÃO DE ACESSO";
const PROVISION_NOTE_HEADER = "CRIAÇÃO DE ACESSO";

// Only these two roles can reach this route, so the label map is narrowed to
// them rather than covering every value of ManagementRole.
type AuthorizedRole = Extract<ManagementRole, "owner" | "administrator">;

const ROLE_LABELS: Record<AuthorizedRole, string> = {
  owner: "Proprietário",
  administrator: "Administrador",
};

type CredentialsRequest = {
  modelId?: unknown;
  password?: unknown;
  /**
   * Either an e-mail address or a bare username. Usernames are registered
   * under MODEL_LOGIN_DOMAIN so Supabase, which authenticates by e-mail only,
   * has an address to work with.
   */
  login?: unknown;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !currentProfile || !currentProfile.active) {
      return NextResponse.json(
        { error: "Seu perfil não está ativo." },
        { status: 403 },
      );
    }

    const currentUserRole = currentProfile.role as ManagementRole;

    // Authorization is server-side and role comes from the database, never
    // from the request. Representatives are deliberately excluded: they have
    // no credential-level powers anywhere in this application.
    //
    // This runs BEFORE any model lookup, so an unauthorized caller learns
    // nothing about whether the model exists.
    if (
      currentUserRole !== "owner" &&
      currentUserRole !== "administrator"
    ) {
      return NextResponse.json(
        {
          error:
            "Você não tem permissão para alterar o acesso desta modelo.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as CredentialsRequest;

    const modelId =
      typeof body.modelId === "string" ? body.modelId.trim() : "";

    if (!modelId) {
      return NextResponse.json(
        { error: "O identificador da modelo é obrigatório." },
        { status: 400 },
      );
    }

    const requestedPassword =
      typeof body.password === "string" ? body.password.trim() : "";

    const rawLogin = typeof body.login === "string" ? body.login.trim() : "";

    if (!requestedPassword && !rawLogin) {
      return NextResponse.json(
        { error: "Informe uma nova senha ou um novo login." },
        { status: 400 },
      );
    }

    if (requestedPassword && requestedPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        },
        { status: 400 },
      );
    }

    let requestedLoginEmail: string | null = null;
    let requestedUsername: string | null = null;

    if (rawLogin) {
      const resolved = resolveLoginIdentifier(rawLogin);

      if (!resolved.ok) {
        return NextResponse.json(
          {
            error:
              resolved.reason === "invalid_email"
                ? "Informe um endereço de e-mail válido."
                : `O nome de usuário deve ter de ${USERNAME_MIN_LENGTH} a ${USERNAME_MAX_LENGTH} caracteres e usar apenas letras, números, ponto, hífen ou sublinhado.`,
          },
          { status: 400 },
        );
      }

      requestedLoginEmail = resolved.email;
      requestedUsername = resolved.username;
    }

    // A real e-mail doubles as her contact address and is mirrored onto the
    // model record; a username is a login-only identifier, so her contact
    // e-mail on file is left exactly as it is.
    const requestedContactEmail =
      requestedLoginEmail && !requestedUsername ? requestedLoginEmail : null;

    const adminSupabase = createAdminClient();

    const { data: model, error: modelError } = await adminSupabase
      .from("models")
      .select("id, display_name, email, profile_id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError) {
      console.error("Erro ao carregar a modelo:", modelError);

      return NextResponse.json(
        { error: "Ocorreu um erro inesperado. Tente novamente." },
        { status: 500 },
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "A modelo solicitada não foi encontrada." },
        { status: 404 },
      );
    }

    // Most model records are created by the public /aplicar form or by the
    // importer, which never create a login — profile_id stays null until
    // somebody provisions one. Those models have no password to change, so
    // instead of refusing, this route creates the account and links it. From
    // the admin's point of view it is the same action: give her access.
    const isProvisioning = !model.profile_id;

    // Her contact e-mail on file, which is NOT necessarily her login: once she
    // has a username, the two diverge on purpose.
    const contactEmail = model.email ?? null;

    // The address she actually authenticates against today.
    let currentLoginEmail: string | null = null;

    if (!isProvisioning) {
      const { data: authUser } = await adminSupabase.auth.admin.getUserById(
        model.profile_id as string,
      );

      currentLoginEmail = authUser?.user?.email ?? null;
    }

    if (isProvisioning) {
      if (!requestedPassword) {
        return NextResponse.json(
          { error: "Informe uma senha para criar o acesso desta modelo." },
          { status: 400 },
        );
      }

      if (!requestedLoginEmail && !contactEmail) {
        return NextResponse.json(
          {
            error:
              "Informe um e-mail ou um nome de usuário para criar o acesso desta modelo.",
          },
          { status: 400 },
        );
      }
    }

    // When provisioning, register whatever was typed, falling back to the
    // contact address already on her record.
    const targetLoginEmail = isProvisioning
      ? (requestedLoginEmail ?? contactEmail)
      : (requestedLoginEmail ?? currentLoginEmail);

    const loginChanged = Boolean(
      requestedLoginEmail &&
        requestedLoginEmail !== (currentLoginEmail ?? "").toLowerCase(),
    );

    // Contact-address collisions are checked here; login collisions are caught
    // by Supabase itself, which enforces uniqueness on auth.users.email.
    if (requestedContactEmail && requestedContactEmail !== contactEmail) {
      const { count, error: duplicateError } = await adminSupabase
        .from("models")
        .select("id", { count: "exact", head: true })
        .eq("email", requestedContactEmail)
        .neq("id", model.id);

      if (!duplicateError && (count ?? 0) > 0) {
        return NextResponse.json(
          { error: "Este e-mail já está em uso por outra conta." },
          { status: 409 },
        );
      }
    }

    let authUserId = model.profile_id as string | null;
    let authError: { message: string } | null = null;

    if (isProvisioning) {
      const { data: createdAuth, error: createAuthError } =
        await adminSupabase.auth.admin.createUser({
          email: targetLoginEmail as string,
          password: requestedPassword,
          // Without email_confirm she would have to click a confirmation link
          // before the account works at all.
          email_confirm: true,
          user_metadata: {
            full_name: model.display_name,
            role: "model",
          },
          app_metadata: {
            role: "model",
          },
        });

      authUserId = createdAuth?.user?.id ?? null;
      authError = createAuthError;
    } else {
      const attributes: {
        password?: string;
        email?: string;
        email_confirm?: boolean;
      } = {};

      if (requestedPassword) {
        attributes.password = requestedPassword;
      }

      if (loginChanged && requestedLoginEmail) {
        attributes.email = requestedLoginEmail;

        // Without email_confirm the model receives a confirmation e-mail and
        // is locked out of her account until she clicks it.
        attributes.email_confirm = true;
      }

      if (Object.keys(attributes).length === 0) {
        return NextResponse.json(
          { error: "Informe uma nova senha ou um novo login." },
          { status: 400 },
        );
      }

      const { error: updateAuthError } =
        await adminSupabase.auth.admin.updateUserById(
          model.profile_id as string,
          attributes,
        );

      authError = updateAuthError;
    }

    if (!authError && !authUserId) {
      authError = { message: "Não foi possível criar o acesso da modelo." };
    }

    if (authError) {
      const message = authError.message.toLowerCase();

      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists")
      ) {
        return NextResponse.json(
          { error: "Este e-mail já está em uso por outra conta." },
          { status: 409 },
        );
      }

      if (message.includes("password")) {
        return NextResponse.json(
          {
            error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
          },
          { status: 400 },
        );
      }

      console.error("Erro ao atualizar o acesso:", authError);

      return NextResponse.json(
        { error: "Ocorreu um erro inesperado. Tente novamente." },
        { status: 500 },
      );
    }

    // The credential change has now happened. Nothing below this line may
    // fail the request — the admin needs the new credentials back even if a
    // bookkeeping write goes wrong.
    const warnings: string[] = [];

    if (isProvisioning && authUserId) {
      // The on_auth_user_created trigger already inserted a profile row from
      // the user metadata; upsert so this works whether or not it fired, and
      // so the name and role are what the model record says they are.
      const { error: profileUpsertError } = await adminSupabase
        .from("profiles")
        .upsert(
          {
            id: authUserId,
            full_name: model.display_name,
            role: "model",
            active: true,
          },
          { onConflict: "id" },
        );

      if (profileUpsertError) {
        console.error(
          "Erro ao criar o perfil da modelo:",
          profileUpsertError,
        );

        warnings.push(
          "O acesso foi criado, mas o perfil da modelo não pôde ser concluído.",
        );
      }

      const { error: linkError } = await adminSupabase
        .from("models")
        .update({
          profile_id: authUserId,
          // Only write back a real address. A username is a login-only
          // identifier and must never overwrite her contact e-mail.
          ...(requestedContactEmail ? { email: requestedContactEmail } : {}),
          website_login_enabled: true,
        })
        .eq("id", model.id);

      if (linkError) {
        console.error(
          "Erro ao vincular o acesso à ficha da modelo:",
          linkError,
        );

        warnings.push(
          "O acesso foi criado, mas não pôde ser vinculado à ficha da modelo. Avise o suporte antes de entregar a senha.",
        );
      }
    }

    // auth.users.email is the login. When the admin supplied a real e-mail it
    // is also her contact address, so it is mirrored onto public.models.email
    // and public.profiles.email. A username updates neither: her contact
    // e-mail stays whatever it was.
    if (!isProvisioning && requestedContactEmail && loginChanged) {
      const { error: modelEmailError } = await adminSupabase
        .from("models")
        .update({ email: requestedContactEmail })
        .eq("id", model.id);

      if (modelEmailError) {
        console.error(
          "Erro ao sincronizar o e-mail na ficha da modelo:",
          modelEmailError,
        );

        warnings.push(
          "O acesso foi alterado, mas o e-mail exibido na ficha da modelo não pôde ser atualizado.",
        );
      }

      const { error: profileEmailError } = await adminSupabase
        .from("profiles")
        .update({ email: requestedContactEmail })
        .eq("id", model.profile_id);

      if (profileEmailError) {
        console.error(
          "Erro ao sincronizar o e-mail no perfil:",
          profileEmailError,
        );
      }
    }

    // A brand-new account has no sessions to end, so this only applies when an
    // existing password was replaced.
    let sessionsRevoked = false;

    if (requestedPassword && !isProvisioning && authUserId) {
      const { error: signOutError } = await adminSupabase.rpc(
        "force_sign_out_user",
        { target_user: authUserId },
      );

      if (signOutError) {
        console.error("Erro ao encerrar as sessões da modelo:", signOutError);

        warnings.push(
          "O acesso foi alterado, mas as sessões abertas da modelo não puderam ser encerradas.",
        );
      } else {
        sessionsRevoked = true;
      }
    }

    const actorName = currentProfile.full_name || "Usuário";

    // What the admin and the model will call the login from now on: the bare
    // username for a synthetic address, the address itself for a real one.
    const loginLabel = describeLogin(targetLoginEmail);
    const previousLoginLabel = describeLogin(currentLoginEmail);

    const noteWritten = await writeAccessChangeNote(adminSupabase, {
      modelId: model.id,
      actorId: currentProfile.id,
      actorName,
      actorRole: currentUserRole,
      provisioned: isProvisioning,
      passwordChanged: Boolean(requestedPassword),
      isUsername: Boolean(
        targetLoginEmail && !looksLikeEmail(loginLabel ?? ""),
      ),
      previousLogin: loginChanged ? previousLoginLabel : null,
      newLogin: isProvisioning || loginChanged ? loginLabel : null,
    });

    if (!noteWritten) {
      warnings.push(
        "O acesso foi alterado, mas não foi possível registrar a nota de auditoria.",
      );
    }

    const changeSummary = isProvisioning
      ? "acesso criado"
      : buildChangeSummary(Boolean(requestedPassword), loginChanged);

    // field_name "password" is in the auditLogger SENSITIVE_FIELDS set, which
    // nulls both value columns — the password can never reach this table.
    await logAuditEntry(adminSupabase, {
      modelId: model.id,
      action: isProvisioning
        ? "model_credentials_created"
        : "model_credentials_updated",
      fieldName: requestedPassword ? "password" : "email",
      previousValue: loginChanged ? previousLoginLabel : null,
      newValue: isProvisioning || loginChanged ? loginLabel : null,
      actor: {
        id: currentProfile.id,
        fullName: actorName,
        role: currentUserRole,
      },
      source: "api:/api/admin/models/credentials",
      summary: isProvisioning
        ? `Acesso ao site criado para a modelo "${model.display_name}"`
        : `Acesso da modelo "${model.display_name}" atualizado (${changeSummary})`,
    });

    return NextResponse.json({
      success: true,
      // The bare username when she has one, otherwise her e-mail address.
      login: loginLabel,
      // Returned once so the admin can hand it over; never persisted anywhere.
      password: requestedPassword || null,
      loginChanged,
      passwordChanged: Boolean(requestedPassword),
      accessCreated: isProvisioning,
      sessionsRevoked,
      warnings,
    });
  } catch (error) {
    console.error("Erro inesperado ao alterar o acesso:", error);

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado. Tente novamente." },
      { status: 500 },
    );
  }
}

function buildChangeSummary(
  passwordChanged: boolean,
  loginChanged: boolean,
): string {
  if (passwordChanged && loginChanged) {
    return "senha e login";
  }

  return passwordChanged ? "senha" : "login";
}

type AccessChangeNoteInput = {
  modelId: string;
  actorId: string;
  actorName: string;
  actorRole: AuthorizedRole;
  provisioned: boolean;
  passwordChanged: boolean;
  isUsername: boolean;
  previousLogin: string | null;
  newLogin: string | null;
};

/**
 * Writes the audit note onto the model's Notes, following the
 * `HEADER — [timestamp]` + `Rótulo — valor` convention from
 * lib/models/applicantIntake.ts.
 *
 * The password is never written here — not the value, not a fragment, not the
 * old one. Only the fact that it changed.
 *
 * Runs on the service-role client so it is unaffected by the staff-only RLS
 * policies on model_notes.
 */
async function writeAccessChangeNote(
  adminSupabase: ReturnType<typeof createAdminClient>,
  {
    modelId,
    actorId,
    actorName,
    actorRole,
    provisioned,
    passwordChanged,
    isUsername,
    previousLogin,
    newLogin,
  }: AccessChangeNoteInput,
): Promise<boolean> {
  const timestamp = formatBrazilDateTime(new Date());

  const header = provisioned ? PROVISION_NOTE_HEADER : AUDIT_NOTE_HEADER;

  const lines = [`${header} — [${timestamp}]`];

  lines.push(`Alterado por — ${actorName} (${ROLE_LABELS[actorRole]})`);

  if (provisioned) {
    lines.push("Acesso ao site — criado");
  }

  if (passwordChanged) {
    lines.push(provisioned ? "Senha — definida" : "Senha — alterada");
  }

  if (newLogin) {
    const label = isUsername ? "Nome de usuário" : "E-mail de login";

    lines.push(
      provisioned
        ? `${label} — ${newLogin}`
        : `${label} — anterior: ${previousLogin || "não informado"} | novo: ${newLogin}`,
    );
  }

  const body = lines.join("\n");

  const { data: createdNote, error: noteError } = await adminSupabase
    .from("model_notes")
    .insert({
      model_id: modelId,
      body,
      priority: "normal",
      pinned: false,
      archived: false,
      author_id: actorId,
      author_name: actorName,
      author_role: actorRole,
      created_by: actorId,
      created_by_name: actorName,
      created_by_role: actorRole,
      updated_by: actorId,
      updated_by_name: actorName,
      updated_by_role: actorRole,
    })
    .select("id")
    .single();

  if (noteError || !createdNote) {
    console.error("Erro ao registrar a nota de alteração de acesso:", noteError);

    return false;
  }

  const { error: historyError } = await adminSupabase
    .from("model_note_history")
    .insert({
      note_id: createdNote.id,
      model_id: modelId,
      action: "created",
      original_body: null,
      updated_body: body,
      editor_id: actorId,
      editor_name: actorName,
      editor_role: actorRole,
    });

  if (historyError) {
    console.error(
      "Erro ao registrar o histórico da nota de alteração de acesso:",
      historyError,
    );
  }

  // Keep the admin models list in step, exactly as the notes API does after
  // every note write.
  const { error: summaryError } = await adminSupabase
    .from("models")
    .update({ latest_note_summary: body.trim().slice(0, 250) })
    .eq("id", modelId);

  if (summaryError) {
    console.error(
      "Erro ao atualizar o resumo da última nota:",
      summaryError,
    );
  }

  return true;
}
