import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logSystemAuditEntry } from "@/lib/audit/auditLogger";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

/**
 * Permanent deletion of a model — the most destructive action in the product.
 *
 * `models` is the parent of twenty-odd tables that cascade on delete: earnings,
 * model_earnings_reports, model_ledger_entries, model_payments, documents,
 * media_records, video_assets, notes, model_notes, model_note_history and
 * model_audit_history among them. One call here erases the model, her profile,
 * her sign-in account and every financial record ever attached to her. There is
 * no undo and no backup inside the application.
 *
 * Two rules follow from that, and both were previously broken:
 *
 *   OWNER ONLY. The database has always said so — `models_delete` and
 *   `profiles_delete` are both `using ( public.is_owner() )`. This route
 *   accepted an administrator and then did the work through the service-role
 *   client, which bypasses RLS, so the policy never got a say. The role check
 *   is now owner-only AND the row deletes go through the caller's own client,
 *   so the database enforces the same rule independently. The service-role
 *   client is used for one thing only: removing the auth user, which has no
 *   RLS equivalent.
 *
 *   THE TRAIL OUTLIVES THE RECORD. The old code wrote its audit row to
 *   model_audit_history AFTER the delete. That table is
 *   `model_id references models(id) on delete cascade`, so the cascade had
 *   already wiped the model's history and the new row was a foreign key
 *   violation against a model that no longer existed. The insert failed, its
 *   error was discarded, and the deletion left no trace anywhere — production
 *   holds zero `model_deleted` rows for exactly this reason. The record now
 *   goes to system_audit_log, whose model_id is `on delete set null` and whose
 *   actor_id is `on delete set null`, so the entry survives both the model and
 *   the departure of whoever wrote it. It is written BEFORE the delete and the
 *   request is refused if it cannot be written: no record, no deletion.
 */

type DeleteBody = {
  modelId?: string;
};

export async function POST(request: Request) {
  const t = await getTranslations("errors.api");
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: t("notAuthenticated") },
        { status: 401 },
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

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: t("invalidProfile") },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    // Administrators are deliberately excluded. They keep every other power
    // over a model — editing, archiving, credentials, earnings — but the one
    // irreversible action belongs to the owner, which is what the RLS policies
    // have said since the initial schema.
    if (role !== "owner") {
      return NextResponse.json(
        { error: t("noPermission") },
        { status: 403 },
      );
    }

    const body = (await request.json()) as DeleteBody;

    if (!body.modelId) {
      return NextResponse.json(
        { error: t("modelIdMissing") },
        { status: 400 },
      );
    }

    const {
      data: model,
      error: modelError,
    } = await supabase
      .from("models")
      .select("id, profile_id, display_name, stage_name, model_number, slug")
      .eq("id", body.modelId)
      .maybeSingle();

    if (modelError) {
      return NextResponse.json(
        { error: modelError.message },
        { status: 500 },
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: t("modelNotFound") },
        { status: 404 },
      );
    }

    const profileId = model.profile_id;

    // What the cascade is about to take with it. Counted first so the audit
    // entry says how much history was destroyed, not merely that a row went.
    const countOf = async (table: string) => {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("model_id", model.id);

      return count ?? 0;
    };

    const [earnings, ledgerEntries, payments, notes, auditRows] =
      await Promise.all([
        countOf("model_earnings_reports"),
        countOf("model_ledger_entries"),
        countOf("model_payments"),
        countOf("model_notes"),
        countOf("model_audit_history"),
      ]);

    // Written before anything is destroyed, and the request stops here if it
    // cannot be written. system_audit_log has no UPDATE or DELETE policy, so
    // no signed-in user — owner included — can revise or remove this row
    // afterwards.
    const { error: auditError } = await logSystemAuditEntry(supabase, {
      action: "model_deleted",
      targetType: "model",
      targetId: model.id,
      targetName: model.display_name,
      modelId: model.id,
      previousValue: {
        display_name: model.display_name,
        stage_name: model.stage_name,
        model_number: model.model_number,
        slug: model.slug,
        profile_id: profileId,
        destroyed_records: {
          earnings_reports: earnings,
          ledger_entries: ledgerEntries,
          payments,
          notes,
          audit_history: auditRows,
        },
      },
      newValue: null,
      actor: {
        id: profile.id,
        fullName: profile.full_name || "Usuário",
        role,
      },
      source: "api:/api/models/delete",
      summary: `Modelo "${model.display_name}" excluída permanentemente (${earnings} relatórios de ganhos, ${ledgerEntries} lançamentos, ${payments} pagamentos, ${notes} notas e ${auditRows} registros de histórico destruídos).`,
    });

    if (auditError) {
      console.error(
        "Exclusão interrompida: o registro de auditoria não pôde ser gravado.",
        auditError,
      );

      return NextResponse.json(
        { error: t("internal") },
        { status: 500 },
      );
    }

    // Through the caller's own client on purpose: RLS re-checks is_owner() at
    // the database, so this route cannot outrank the policy even by mistake.
    const { error: deleteModelError } = await supabase
      .from("models")
      .delete()
      .eq("id", body.modelId);

    if (deleteModelError) {
      return NextResponse.json(
        { error: deleteModelError.message },
        { status: 500 },
      );
    }

    if (profileId) {
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      if (deleteProfileError) {
        console.error(
          "Modelo excluída, mas o perfil não pôde ser removido:",
          deleteProfileError,
        );
      }

      // The only step with no RLS equivalent — auth.users is not reachable
      // from a request-scoped client.
      const adminSupabase = createAdminClient();

      const { error: deleteAuthUserError } =
        await adminSupabase.auth.admin.deleteUser(profileId);

      if (deleteAuthUserError) {
        console.error(
          "Modelo excluída, mas o acesso não pôde ser removido:",
          deleteAuthUserError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `${model.display_name} foi excluída permanentemente.`,
    });
  } catch (error) {
    console.error("Erro ao excluir modelo:", error);

    return NextResponse.json(
      { error: t("internal") },
      { status: 500 },
    );
  }
}
