import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computePayout } from "../lib/earnings/payout";
import {
  mapLedgerEntry,
  selectDeductionsForPeriod,
  type LedgerEntryRow,
} from "../lib/ledger/entries";
import { validateLedgerPayload } from "../lib/ledger/validation";

function entryRow(overrides: Partial<LedgerEntryRow> = {}): LedgerEntryRow {
  return {
    id: "entry-1",
    model_id: "model-1",
    entry_type: "transporte",
    provider: "uber",
    hotel_name: null,
    amount_brl: "45.00",
    incurred_on: "2026-07-12",
    deduct_on: null,
    deduction_fx_rate: null,
    deduction_amount_usd: null,
    deducted_at: null,
    created_at: "2026-07-12T10:00:00Z",
    updated_at: "2026-07-12T10:00:00Z",
    ...overrides,
  };
}

describe("ledger entry status", () => {
  it("is pending while no deduction date is set", () => {
    const entry = mapLedgerEntry(entryRow());

    assert.equal(entry.status.kind, "pendente");
    assert.equal(entry.status.label, "Pendente");
  });

  it("is scheduled once a future date is set", () => {
    const entry = mapLedgerEntry(entryRow({ deduct_on: "2026-09-05" }));

    assert.equal(entry.status.kind, "agendado");
    assert.equal(entry.status.label, "Agendado para 05/09/2026");
  });

  it("names the month it was deducted in", () => {
    const entry = mapLedgerEntry(
      entryRow({
        deduct_on: "2026-09-05",
        deduction_fx_rate: "5.42",
        deduction_amount_usd: "8.30",
        deducted_at: "2026-09-05T03:10:00Z",
      }),
    );

    assert.equal(entry.status.kind, "descontado");
    assert.equal(entry.status.label, "Descontado em SETEMBRO/2026");
  });
});

describe("selectDeductionsForPeriod", () => {
  const uberDeductedInSeptember = mapLedgerEntry(
    entryRow({
      id: "uber",
      incurred_on: "2026-07-12",
      deduct_on: "2026-09-05",
      deduction_fx_rate: "5.42",
      deduction_amount_usd: "92.25",
      deducted_at: "2026-09-05T03:10:00Z",
    }),
  );

  const pendingHotel = mapLedgerEntry(
    entryRow({
      id: "hotel",
      entry_type: "hotel",
      provider: null,
      hotel_name: "Ibis Centro",
      amount_brl: "220.00",
      incurred_on: "2026-07-12",
    }),
  );

  const entries = [uberDeductedInSeptember, pendingHotel];

  it("ignores the month the cost was incurred in", () => {
    assert.deepEqual(selectDeductionsForPeriod(entries, "2026-07-01"), []);
  });

  it("counts the entry in the month its deduction date falls in", () => {
    const september = selectDeductionsForPeriod(entries, "2026-09-01");

    assert.equal(september.length, 1);
    assert.equal(september[0].id, "uber");
    assert.equal(september[0].amountUsd, 92.25);
    assert.equal(september[0].label, "Transporte · Uber");
  });

  it("never counts an entry with no deduction date", () => {
    for (const period of ["2026-07-01", "2026-08-01", "2026-09-01"]) {
      const found = selectDeductionsForPeriod([pendingHotel], period);
      assert.deepEqual(found, []);
    }
  });

  it("ignores a scheduled entry until it has been snapshotted", () => {
    const scheduled = mapLedgerEntry(
      entryRow({ id: "future", deduct_on: "2026-09-05" }),
    );

    assert.deepEqual(selectDeductionsForPeriod([scheduled], "2026-09-01"), []);
  });
});

describe("computePayout", () => {
  it("takes the deductions out of the model's share", () => {
    const payout = computePayout({
      grossUsd: 1200,
      modelPct: 60,
      deductionsUsd: 92.25,
    });

    assert.equal(payout.modelShareUsd, 720);
    assert.equal(payout.payableUsd, 627.75);
    assert.equal(payout.remainingUsd, 0);
  });

  it("never renders a negative payout", () => {
    const payout = computePayout({
      grossUsd: 100,
      modelPct: 60,
      deductionsUsd: 90,
    });

    assert.equal(payout.payableUsd, 0);
    assert.equal(payout.remainingUsd, 30);
  });
});

describe("validateLedgerPayload", () => {
  it("requires a provider for transporte", () => {
    const result = validateLedgerPayload({
      entryType: "transporte",
      amountBrl: 45,
      incurredOn: "2026-07-12",
    });

    assert.equal(result.ok, false);
  });

  it("requires a hotel name for hotel", () => {
    const result = validateLedgerPayload({
      entryType: "hotel",
      hotelName: "   ",
      amountBrl: 220,
      incurredOn: "2026-07-12",
    });

    assert.equal(result.ok, false);
  });

  it("accepts a loan with no deduction date", () => {
    const result = validateLedgerPayload({
      entryType: "emprestimo",
      amountBrl: 500,
      incurredOn: "2026-07-12",
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.deductOn, null);
      assert.equal(result.value.provider, null);
      assert.equal(result.value.amountBrl, 500);
    }
  });

  it("rejects a non-positive amount", () => {
    const result = validateLedgerPayload({
      entryType: "emprestimo",
      amountBrl: 0,
      incurredOn: "2026-07-12",
    });

    assert.equal(result.ok, false);
  });

  it("keeps the stored type on edit", () => {
    const result = validateLedgerPayload(
      {
        entryType: "emprestimo",
        hotelName: "Ibis Centro",
        amountBrl: 220,
        incurredOn: "2026-07-12",
      },
      "hotel",
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.entryType, "hotel");
    }
  });
});
