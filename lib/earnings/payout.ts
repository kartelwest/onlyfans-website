export type Payout = {
  modelShareUsd: number;
  /** Never negative. */
  payableUsd: number;
  /** What is left to deduct when the deductions exceeded her share. */
  remainingUsd: number;
};

/**
 * The model's share of a month, minus the deductions dated into that month.
 *
 * A month never renders a negative payout: whatever exceeds her share stays as
 * an outstanding balance for the agency to re-date by hand. There is no
 * automatic rollover — nothing here touches the next month.
 */
export function computePayout({
  grossUsd,
  modelPct,
  deductionsUsd,
}: {
  grossUsd: number;
  modelPct: number;
  deductionsUsd: number;
}): Payout {
  const modelShareUsd = grossUsd * (modelPct / 100);

  return {
    modelShareUsd,
    payableUsd: Math.max(0, modelShareUsd - deductionsUsd),
    remainingUsd: Math.max(0, deductionsUsd - modelShareUsd),
  };
}
