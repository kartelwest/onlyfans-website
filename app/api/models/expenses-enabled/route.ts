import { NextRequest, NextResponse } from "next/server";

import { logAuditEntry, getFieldLabel } from "@/lib/audit/auditLogger";
import { requireModelAccess, requireStaff } from "@/lib/api/requireRole";

export const dynamic = "force-dynamic";

// The Brazil-only expenses/loans eligibility flag. Owner and administrator
// only: a representative can neither read nor toggle it, and every change is
// written to the admin history.

export async function GET(request: NextRequest) {
  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;
  const modelId = request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  const access = await requireModelAccess(supabase, profile, modelId);

  if (!access.ok) {
    return access.response;
  }

  // Drives the confirmation dialog: unchecking a model who already has entries
  // has to say how many are involved.
  const { count } = await supabase
    .from("model_ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("model_id", modelId)
    .is("deleted_at", null);

  return NextResponse.json({
    expensesEnabled: access.expensesEnabled,
    entryCount: count ?? 0,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  const body = (await request.json()) as {
    modelId?: unknown;
    enabled?: unknown;
  };

  if (typeof body.modelId !== "string" || !body.modelId) {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "Valor inválido." },
      { status: 400 },
    );
  }

  const access = await requireModelAccess(supabase, profile, body.modelId);

  if (!access.ok) {
    return access.response;
  }

  if (access.expensesEnabled === body.enabled) {
    return NextResponse.json({ success: true, expensesEnabled: body.enabled });
  }

  const { error } = await supabase
    .from("models")
    .update({ expenses_enabled: body.enabled })
    .eq("id", body.modelId);

  if (error) {
    console.error("Erro ao alterar a elegibilidade de lançamentos:", error);

    // Surface the database's own reason: this endpoint is owner/administrator
    // only, and a swallowed "permission denied for column expenses_enabled"
    // is exactly what made this look like a silent no-op the first time.
    return NextResponse.json(
      { error: error.message || "Não foi possível alterar a configuração." },
      { status: 500 },
    );
  }

  // Nothing is deleted on the way out: existing rows and history stay put,
  // already-snapshotted deductions stay frozen, and scheduled ones simply stop
  // being snapshotted until the box is checked again (see
  // snapshotDueLedgerEntries, which filters on expenses_enabled).
  await logAuditEntry(supabase, {
    modelId: body.modelId,
    action: "field_update",
    fieldName: "expenses_enabled",
    previousValue: String(access.expensesEnabled),
    newValue: String(body.enabled),
    actor: profile,
    source: "api:/api/models/expenses-enabled",
    summary: `${getFieldLabel("expenses_enabled")} ${
      body.enabled ? "ativado(s)" : "desativado(s)"
    } para esta modelo`,
  });

  return NextResponse.json({ success: true, expensesEnabled: body.enabled });
}
