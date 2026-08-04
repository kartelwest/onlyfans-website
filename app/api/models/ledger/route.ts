import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  authenticate,
  isStaffRole,
  requireModelAccess,
  rpcErrorResponse,
} from "@/lib/api/requireRole";
import {
  LEDGER_ENTRY_COLUMNS,
  mapLedgerEntry,
  type LedgerEntryRow,
} from "@/lib/ledger/entries";
import { snapshotDueLedgerEntries } from "@/lib/ledger/snapshot";
import {
  validateLedgerPayload,
  type LedgerWriteBody,
} from "@/lib/ledger/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t = await getTranslations("errors.api");
  const auth = await authenticate();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;
  const modelId = request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: t("modelIdMissing") },
      { status: 400 },
    );
  }

  const access = await requireModelAccess(supabase, profile, modelId);

  if (!access.ok) {
    return access.response;
  }

  // With the feature off, the ledger does not exist as far as a rep or a model
  // is concerned — not an empty list, no endpoint.
  if (!access.expensesEnabled && !isStaffRole(profile.role)) {
    return NextResponse.json({ error: t("noPermission") }, { status: 403 });
  }

  // Lazily catch up on any deduction whose date has arrived, so the statuses
  // and amounts below are correct even if the daily cron never ran.
  if (access.expensesEnabled) {
    await snapshotDueLedgerEntries(createAdminClient(), { modelId });
  }

  const { data, error } = await supabase
    .from("model_ledger_entries")
    .select(LEDGER_ENTRY_COLUMNS)
    .eq("model_id", modelId)
    .is("deleted_at", null)
    .order("incurred_on", { ascending: false });

  if (error) {
    console.error("Erro ao carregar lançamentos:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar os lançamentos." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    entries: ((data ?? []) as unknown as LedgerEntryRow[]).map(mapLedgerEntry),
    expensesEnabled: access.expensesEnabled,
    canWrite: isStaffRole(profile.role) && access.expensesEnabled,
  });
}

export async function POST(request: NextRequest) {
  const t = await getTranslations("errors.api");
  const auth = await authenticate();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  // Reps and models never write, whatever the model's eligibility is.
  if (!isStaffRole(profile.role)) {
    return NextResponse.json({ error: t("noPermission") }, { status: 403 });
  }

  const body = (await request.json()) as LedgerWriteBody;
  const modelId = typeof body.modelId === "string" ? body.modelId : "";

  if (!modelId) {
    return NextResponse.json(
      { error: t("modelIdMissing") },
      { status: 400 },
    );
  }

  const access = await requireModelAccess(supabase, profile, modelId);

  if (!access.ok) {
    return access.response;
  }

  // 403 even for an owner: the eligibility flag gates the data, not the role.
  if (!access.expensesEnabled) {
    return NextResponse.json(
      { error: "Lançamentos estão desativados para esta modelo." },
      { status: 403 },
    );
  }

  const validation = validateLedgerPayload(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const entry = validation.value;

  // One transaction writes the entry, the model-facing note and the admin
  // history record — see create_model_ledger_entry in the ledger migration.
  const { data: entryId, error } = await supabase.rpc(
    "create_model_ledger_entry",
    {
      p_model_id: modelId,
      p_entry_type: entry.entryType,
      p_provider: entry.provider,
      p_hotel_name: entry.hotelName,
      p_amount_brl: entry.amountBrl,
      p_incurred_on: entry.incurredOn,
      p_deduct_on: entry.deductOn,
    },
  );

  if (error) {
    console.error("Erro ao criar lançamento:", error);

    return rpcErrorResponse(error, "Não foi possível salvar o lançamento.");
  }

  // A deduction dated today or earlier is snapshotted immediately instead of
  // waiting for the next cron run.
  if (entry.deductOn) {
    await snapshotDueLedgerEntries(createAdminClient(), { modelId });
  }

  const { data: created } = await supabase
    .from("model_ledger_entries")
    .select(LEDGER_ENTRY_COLUMNS)
    .eq("id", entryId as string)
    .maybeSingle();

  return NextResponse.json({
    entry: created
      ? mapLedgerEntry(created as unknown as LedgerEntryRow)
      : null,
  });
}
