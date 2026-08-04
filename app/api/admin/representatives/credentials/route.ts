import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logSystemAuditEntry } from "@/lib/audit/auditLogger";
import {
  describeLogin,
  resolveLoginIdentifier,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/loginIdentifier";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * The representative's login: the address or username she signs in with, and
 * her password.
 *
 * Deliberately the same shape as /api/admin/models/credentials, because it is
 * the same job on a different account type. In particular:
 *
 *   - The password is handed to Supabase Auth and never touches this codebase's
 *     tables. There is no password column to write and none is added here.
 *   - It is returned to the caller exactly once, so the admin can pass it on,
 *     and is never persisted, logged or re-displayed.
 *   - The audit row records that a password changed, never what it changed to.
 *     `logSystemAuditEntry` receives no password field at all.
 *   - Changing the password ends the representative's open sessions and forces
 *     a new password at her next login.
 *
 * Authorization is read from the database, never from the request. Only owner
 * and administrator reach this route.
 */

const MIN_PASSWORD_LENGTH = 8;

type AuthorizedRole = Extract<ManagementRole, "owner" | "administrator">;

type CredentialsRequest = {
  representativeId?: unknown;
  password?: unknown;
  /** An e-mail address or a bare username. */
  login?: unknown;
};

export async function POST(request: Request) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.repCredentials");
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: t("sessionExpired") },
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
        { error: t("profileInactive") },
        { status: 403 },
      );
    }

    const currentUserRole = currentProfile.role as ManagementRole;

    // Runs before any lookup, so an unauthorized caller learns nothing about
    // which representatives exist.
    if (currentUserRole !== "owner" && currentUserRole !== "administrator") {
      return NextResponse.json(
        { error: tRoute("notPermitted") },
        { status: 403 },
      );
    }

    const body = (await request.json()) as CredentialsRequest;

    const representativeId =
      typeof body.representativeId === "string"
        ? body.representativeId.trim()
        : "";

    if (!representativeId) {
      return NextResponse.json(
        { error: tRoute("idRequired") },
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
                ? t("invalidEmail")
                : `O nome de usuário deve ter de ${USERNAME_MIN_LENGTH} a ${USERNAME_MAX_LENGTH} caracteres e usar apenas letras, números, ponto, hífen ou sublinhado.`,
          },
          { status: 400 },
        );
      }

      requestedLoginEmail = resolved.email;
      requestedUsername = resolved.username;
    }

    // A real address doubles as the contact e-mail shown on her profile; a
    // username is a login-only identifier and leaves the contact e-mail alone.
    const requestedContactEmail =
      requestedLoginEmail && !requestedUsername ? requestedLoginEmail : null;

    const adminSupabase = createAdminClient();

    const { data: representative, error: representativeError } =
      await adminSupabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", representativeId)
        .maybeSingle();

    if (representativeError) {
      console.error("Erro ao carregar o representante:", representativeError);

      return NextResponse.json(
        { error: "Ocorreu um erro inesperado. Tente novamente." },
        { status: 500 },
      );
    }

    if (!representative) {
      return NextResponse.json(
        { error: tRoute("notFound") },
        { status: 404 },
      );
    }

    if (representative.role !== "representative") {
      return NextResponse.json(
        { error: tRoute("notARepresentative") },
        { status: 400 },
      );
    }

    const { data: authUser, error: authLookupError } =
      await adminSupabase.auth.admin.getUserById(representativeId);

    if (authLookupError || !authUser?.user) {
      console.error("Erro ao carregar o acesso do representante:", authLookupError);

      return NextResponse.json(
        {
          error:
            tRoute("noAuthAccount"),
        },
        { status: 409 },
      );
    }

    const currentLoginEmail = authUser.user.email ?? null;

    const loginChanged = Boolean(
      requestedLoginEmail &&
        requestedLoginEmail !== (currentLoginEmail ?? "").toLowerCase(),
    );

    if (rawLogin && !loginChanged && !requestedPassword) {
      return NextResponse.json(
        { error: tRoute("sameLogin") },
        { status: 400 },
      );
    }

    // Contact-address collisions are checked here; login collisions are caught
    // by Supabase, which enforces uniqueness on auth.users.email across every
    // account type — a username already taken by a model is refused too.
    if (requestedContactEmail && requestedContactEmail !== representative.email) {
      const { count, error: duplicateError } = await adminSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("email", requestedContactEmail)
        .neq("id", representative.id);

      if (!duplicateError && (count ?? 0) > 0) {
        return NextResponse.json(
          { error: tRoute("emailInUse") },
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

    if (loginChanged && requestedLoginEmail) {
      attributes.email = requestedLoginEmail;

      // Without email_confirm the representative is sent a confirmation link
      // and is locked out of her own account until she clicks it.
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
        representativeId,
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
          { error: tRoute("loginInUse") },
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

      console.error("Erro ao atualizar o acesso do representante:", updateAuthError);

      return NextResponse.json(
        { error: "Ocorreu um erro inesperado. Tente novamente." },
        { status: 500 },
      );
    }

    // The credential change has now happened. Nothing below may fail the
    // request — the admin needs the new credentials back regardless.
    const warnings: string[] = [];

    if (requestedContactEmail && loginChanged) {
      const { error: emailSyncError } = await adminSupabase
        .from("profiles")
        .update({ email: requestedContactEmail })
        .eq("id", representativeId);

      if (emailSyncError) {
        console.error("Erro ao sincronizar o e-mail do perfil:", emailSyncError);

        warnings.push(
          tRoute("profileEmailNotUpdated"),
        );
      }
    }

    // A password handed over by an administrator is temporary by definition:
    // the representative is sent to /alterar-senha at her next login, the same
    // rule already applied to a model's first password.
    let mustChangePassword = false;

    if (requestedPassword) {
      const { error: flagError } = await adminSupabase
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", representativeId);

      if (flagError) {
        console.error(
          "Failed to require a password change at next sign-in:",
          flagError,
        );

        warnings.push(
          tRoute("passwordChangeNotRequired"),
        );
      } else {
        mustChangePassword = true;
      }
    }

    let sessionsRevoked = false;

    if (requestedPassword) {
      const { error: signOutError } = await adminSupabase.rpc(
        "force_sign_out_user",
        { target_user: representativeId },
      );

      if (signOutError) {
        console.error("Failed to end the representative's sessions:", signOutError);

        warnings.push(
          tRoute("sessionsNotEnded"),
        );
      } else {
        sessionsRevoked = true;
      }
    }

    const actorName = currentProfile.full_name || "Usuário";

    const loginLabel = describeLogin(requestedLoginEmail ?? currentLoginEmail);
    const previousLoginLabel = describeLogin(currentLoginEmail);

    const changeSummary =
      requestedPassword && loginChanged
        ? "senha e login"
        : requestedPassword
          ? "senha"
          : "login";

    // previous_value / new_value carry the LOGIN only. The password is not
    // passed to this call in any form, so there is nothing to redact.
    await logSystemAuditEntry(adminSupabase, {
      action: "representative_credentials_updated",
      targetType: "representative",
      targetId: representativeId,
      targetName: representative.full_name,
      actor: {
        id: currentProfile.id,
        fullName: actorName,
        role: currentUserRole as AuthorizedRole,
      },
      previousValue: {
        login: loginChanged ? previousLoginLabel : null,
        password_changed: false,
      },
      newValue: {
        login: loginChanged ? loginLabel : null,
        password_changed: Boolean(requestedPassword),
        must_change_password: mustChangePassword,
      },
      source: "api:/api/admin/representatives/credentials",
      summary: `${actorName} atualizou o acesso do representante ${
        representative.full_name ?? "sem nome"
      } (${changeSummary}).`,
    });

    return NextResponse.json({
      success: true,
      login: loginLabel,
      // Returned once so the admin can hand it over; never persisted.
      password: requestedPassword || null,
      loginChanged,
      passwordChanged: Boolean(requestedPassword),
      mustChangePassword,
      sessionsRevoked,
      warnings,
    });
  } catch (error) {
    console.error("Erro inesperado ao alterar o acesso do representante:", error);

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado. Tente novamente." },
      { status: 500 },
    );
  }
}
