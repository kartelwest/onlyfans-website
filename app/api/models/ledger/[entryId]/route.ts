import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  isStaffRole,
  requireModelAccess,
  requireStaff,
  rpcErrorResponse,
} from "@/lib/api/requireRole";
import {
  LEDGER_ENTRY_COLUMNS,
  mapLedgerEntry,
  type LedgerEntryRow,
} from "@/lib/ledger/entries";
import { snapshotDueLedgerEntries } from "@/lib/ledger/snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  isIsoDate,
  validateLedgerPayload,
  type LedgerWriteBody,
} from "@/lib/ledger/validation";

import type { LedgerEntryType } from "@/types/ledger";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

type PatchBody = LedgerWriteBody & {
  /** `set_deduct_on` only re-dates the deduction; anything else is a full edit. */
  action?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const tAll = await getTranslations();
  const tRoute = await getTranslations("errors.ledger");
  const { entryId } = await context.params;

  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("model_ledger_entries")
    .select("id, model_id, entry_type")
    .eq("id", entryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json(
      { error: tRoute("entryNotFound") },
      { status: 404 },
    );
  }

  const modelId = existing.model_id as string;
  const access = await requireModelAccess(supabase, profile, modelId);

  if (!access.ok) {
    return access.response;
  }

  if (!access.expensesEnabled) {
    return NextResponse.json(
      { error: tRoute("ledgerDisabled") },
      { status: 403 },
    );
  }

  const body = (await request.json()) as PatchBody;

  if (body.action === "set_deduct_on") {
    const deductOn =
      typeof body.deductOn === "string" && body.deductOn.trim()
        ? body.deductOn.trim()
        : null;

    if (deductOn !== null && !isIsoDate(deductOn)) {
      return NextResponse.json(
        { error: tRoute("invalidDeductDate") },
        { status: 400 },
      );
    }

    const { error } = await supabase.rpc("set_model_ledger_deduct_on", {
      p_entry_id: entryId,
      p_deduct_on: deductOn,
    });

    if (error) {
      console.error("Erro ao alterar a data de desconto:", error);

      return await rpcErrorResponse(
        error,
        tRoute("deductDateFailed"),
      );
    }
  } else {
    // entry_type is immutable: changing it would invalidate the note template
    // and the type-specific NOT NULL checks, so the form re-creates instead.
    const validation = validateLedgerPayload(
      body,
      existing.entry_type as LedgerEntryType,
    );

    if (!validation.ok) {
      return NextResponse.json({ error: tAll(validation.errorKey) }, { status: 400 });
    }

    const entry = validation.value;

    const { error } = await supabase.rpc("update_model_ledger_entry", {
      p_entry_id: entryId,
      p_provider: entry.provider,
      p_hotel_name: entry.hotelName,
      p_amount_brl: entry.amountBrl,
      p_incurred_on: entry.incurredOn,
      p_deduct_on: entry.deductOn,
    });

    if (error) {
      console.error("Failed to edit the ledger entry:", error);

      return await rpcErrorResponse(error, tRoute("saveFailed"));
    }
  }

  // Re-dating clears any previous snapshot; take the new one right away when
  // the new date has already passed.
  await snapshotDueLedgerEntries(createAdminClient(), { modelId });

  const { data: updated } = await supabase
    .from("model_ledger_entries")
    .select(LEDGER_ENTRY_COLUMNS)
    .eq("id", entryId)
    .maybeSingle();

  return NextResponse.json({
    entry: updated
      ? mapLedgerEntry(updated as unknown as LedgerEntryRow)
      : null,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.ledger");
  const { entryId } = await context.params;

  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  if (!isStaffRole(profile.role)) {
    return NextResponse.json({ error: t("noPermission") }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("model_ledger_entries")
    .select("id, model_id")
    .eq("id", entryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: tRoute("entryNotFound") },
      { status: 404 },
    );
  }

  const access = await requireModelAccess(
    supabase,
    profile,
    existing.model_id as string,
  );

  if (!access.ok) {
    return access.response;
  }

  if (!access.expensesEnabled) {
    return NextResponse.json(
      { error: tRoute("ledgerDisabled") },
      { status: 403 },
    );
  }

  // Soft delete: the row and its history stay, the note leaves the
  // model-facing view.
  const { error } = await supabase.rpc("delete_model_ledger_entry", {
    p_entry_id: entryId,
  });

  if (error) {
    console.error("Failed to delete the ledger entry:", error);

    return await rpcErrorResponse(error, tRoute("deleteFailed"));
  }

  return NextResponse.json({ success: true });
}
