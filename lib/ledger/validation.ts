import { isLedgerEntryType, isLedgerProvider } from "@/lib/ledger/entries";

import type { LedgerEntryType, LedgerProvider } from "@/types/ledger";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validation failures are reported as catalogue keys under `validation.ledger`.
 * This module runs on the server and in the browser, and the wording belongs to
 * whoever renders it — not to the rule that failed.
 */
export const LEDGER_VALIDATION_KEYS = {
  invalidType: "validation.ledger.invalidType",
  amountRequired: "validation.ledger.amountRequired",
  incurredOnRequired: "validation.ledger.incurredOnRequired",
  invalidDeductDate: "validation.ledger.invalidDeductDate",
  providerRequired: "validation.ledger.providerRequired",
  hotelNameRequired: "validation.ledger.hotelNameRequired",
} as const;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

export type LedgerWriteBody = {
  modelId?: unknown;
  entryType?: unknown;
  provider?: unknown;
  hotelName?: unknown;
  amountBrl?: unknown;
  incurredOn?: unknown;
  deductOn?: unknown;
};

export type ValidatedLedgerEntry = {
  entryType: LedgerEntryType;
  provider: LedgerProvider | null;
  hotelName: string | null;
  amountBrl: number;
  incurredOn: string;
  deductOn: string | null;
};

export type LedgerValidation =
  | { ok: true; value: ValidatedLedgerEntry }
  | { ok: false; errorKey: string };

/**
 * Validates a create or edit payload. On edit the type is fixed by the stored
 * row (`currentType`): changing it would invalidate the note template and the
 * type-specific database checks.
 */
export function validateLedgerPayload(
  body: LedgerWriteBody,
  currentType?: LedgerEntryType,
): LedgerValidation {
  const entryType = currentType ?? body.entryType;

  if (!isLedgerEntryType(entryType)) {
    return { ok: false, errorKey: LEDGER_VALIDATION_KEYS.invalidType };
  }

  const amountBrl = Number(body.amountBrl);

  if (!Number.isFinite(amountBrl) || amountBrl <= 0) {
    return { ok: false, errorKey: LEDGER_VALIDATION_KEYS.amountRequired };
  }

  if (!isIsoDate(body.incurredOn)) {
    return { ok: false, errorKey: LEDGER_VALIDATION_KEYS.incurredOnRequired };
  }

  const rawDeductOn =
    typeof body.deductOn === "string" && body.deductOn.trim()
      ? body.deductOn.trim()
      : null;

  if (rawDeductOn !== null && !isIsoDate(rawDeductOn)) {
    return { ok: false, errorKey: LEDGER_VALIDATION_KEYS.invalidDeductDate };
  }

  let provider: LedgerProvider | null = null;
  let hotelName: string | null = null;

  if (entryType === "transporte") {
    if (!isLedgerProvider(body.provider)) {
      return { ok: false, errorKey: LEDGER_VALIDATION_KEYS.providerRequired };
    }

    provider = body.provider;
  }

  if (entryType === "hotel") {
    hotelName = typeof body.hotelName === "string" ? body.hotelName.trim() : "";

    if (!hotelName) {
      return { ok: false, errorKey: LEDGER_VALIDATION_KEYS.hotelNameRequired };
    }
  }

  return {
    ok: true,
    value: {
      entryType,
      provider,
      hotelName,
      amountBrl: Math.round(amountBrl * 100) / 100,
      incurredOn: body.incurredOn,
      deductOn: rawDeductOn,
    },
  };
}
