import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/admin/modelOnboardingHelpers";
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
  email?: unknown;
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

    const emailResult = normalizeEmail(
      typeof body.email === "string" ? body.email : "",
    );

    const requestedEmail = emailResult.value;

    if (!requestedPassword && !requestedEmail) {
      return NextResponse.json(
        { error: "Informe uma nova senha ou um novo e-mail." },
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

    if (requestedEmail && !emailResult.valid) {
      return NextResponse.json(
        { error: "Informe um endereço de e-mail válido." },
        { status: 400 },
      );
    }

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

    if (!model.profile_id) {
      return NextResponse.json(
        { error: "Esta modelo ainda não possui acesso ao site." },
        { status: 400 },
      );
    }

    const previousEmail = model.email ?? null;

    const emailChanged = Boolean(
      requestedEmail &&
        requestedEmail.toLowerCase() !== (previousEmail ?? "").toLowerCase(),
    );

    // Only guard against duplicates when the address is actually changing —
    // re-submitting the model's current e-mail must not collide with herself.
    if (emailChanged) {
      const { count, error: duplicateError } = await adminSupabase
        .from("models")
        .select("id", { count: "exact", head: true })
        .eq("email", requestedEmail)
        .neq("id", model.id);

      if (!duplicateError && (count ?? 0) > 0) {
        return NextResponse.json(
          { error: "Este e-mail já está em uso por outra conta." },
          { status: 409 },
        );
      }
    }

    const attributes: {
      password?: string;
      email?: string;
      email_confirm?: boolean;
    } = {};

    if (requestedPassword) {
      attributes.password = requestedPassword;
    }

    if (emailChanged && requestedEmail) {
      attributes.email = requestedEmail;

      // Without email_confirm the model receives a confirmation e-mail and is
      // locked out of her account until she clicks it.
      attributes.email_confirm = true;
    }

    if (Object.keys(attributes).length === 0) {
      return NextResponse.json(
        { error: "Informe uma nova senha ou um novo e-mail." },
        { status: 400 },
      );
    }

    const { error: updateAuthError } =
      await adminSupabase.auth.admin.updateUserById(
        model.profile_id,
        attributes,
      );

    if (updateAuthError) {
      const message = updateAuthError.message.toLowerCase();

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

      console.error("Erro ao atualizar o acesso:", updateAuthError);

      return NextResponse.json(
        { error: "Ocorreu um erro inesperado. Tente novamente." },
        { status: 500 },
      );
    }

    // The credential change has now happened. Nothing below this line may
    // fail the request — the admin needs the new credentials back even if a
    // bookkeeping write goes wrong.
    const warnings: string[] = [];

    // The login identifier lives in auth.users.email, but it is mirrored on
    // public.models.email (shown across the admin UI and used for duplicate
    // checks) and on public.profiles.email. Keep all three in step.
    if (emailChanged && requestedEmail) {
      const { error: modelEmailError } = await adminSupabase
        .from("models")
        .update({ email: requestedEmail })
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
        .update({ email: requestedEmail })
        .eq("id", model.profile_id);

      if (profileEmailError) {
        console.error(
          "Erro ao sincronizar o e-mail no perfil:",
          profileEmailError,
        );
      }
    }

    // A password reset that leaves her existing session alive does not take
    // access away from anyone, so revoke it. This cannot go through
    // auth.admin.signOut(): that takes the user's own JWT, not a user id, and
    // there is no per-user revocation in the admin API at all — see the
    // force_sign_out_user migration. Deleting her sessions cascades to her
    // refresh tokens, so the session she holds cannot be extended past the
    // access token already issued to it.
    let sessionsRevoked = false;

    if (requestedPassword) {
      const { error: signOutError } = await adminSupabase.rpc(
        "force_sign_out_user",
        { target_user: model.profile_id },
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

    const noteWritten = await writeAccessChangeNote(adminSupabase, {
      modelId: model.id,
      actorId: currentProfile.id,
      actorName,
      actorRole: currentUserRole,
      passwordChanged: Boolean(requestedPassword),
      previousEmail: emailChanged ? previousEmail : null,
      newEmail: emailChanged ? requestedEmail : null,
    });

    if (!noteWritten) {
      warnings.push(
        "O acesso foi alterado, mas não foi possível registrar a nota de auditoria.",
      );
    }

    const changeSummary = buildChangeSummary(
      Boolean(requestedPassword),
      emailChanged,
    );

    // field_name "password" is in the auditLogger SENSITIVE_FIELDS set, which
    // nulls both value columns — the password can never reach this table.
    await logAuditEntry(adminSupabase, {
      modelId: model.id,
      action: "model_credentials_updated",
      fieldName: requestedPassword ? "password" : "email",
      previousValue: emailChanged ? previousEmail : null,
      newValue: emailChanged ? requestedEmail : null,
      actor: {
        id: currentProfile.id,
        fullName: actorName,
        role: currentUserRole,
      },
      source: "api:/api/admin/models/credentials",
      summary: `Acesso da modelo "${model.display_name}" atualizado (${changeSummary})`,
    });

    return NextResponse.json({
      success: true,
      email: emailChanged ? requestedEmail : previousEmail,
      // Returned once so the admin can hand it over; never persisted anywhere.
      password: requestedPassword || null,
      emailChanged,
      passwordChanged: Boolean(requestedPassword),
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
  emailChanged: boolean,
): string {
  if (passwordChanged && emailChanged) {
    return "senha e e-mail de login";
  }

  return passwordChanged ? "senha" : "e-mail de login";
}

type AccessChangeNoteInput = {
  modelId: string;
  actorId: string;
  actorName: string;
  actorRole: AuthorizedRole;
  passwordChanged: boolean;
  previousEmail: string | null;
  newEmail: string | null;
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
    passwordChanged,
    previousEmail,
    newEmail,
  }: AccessChangeNoteInput,
): Promise<boolean> {
  const timestamp = formatBrazilDateTime(new Date());

  const lines = [`${AUDIT_NOTE_HEADER} — [${timestamp}]`];

  lines.push(`Alterado por — ${actorName} (${ROLE_LABELS[actorRole]})`);

  if (passwordChanged) {
    lines.push("Senha — alterada");
  }

  if (newEmail) {
    lines.push(
      `E-mail de login — anterior: ${previousEmail || "não informado"} | novo: ${newEmail}`,
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
