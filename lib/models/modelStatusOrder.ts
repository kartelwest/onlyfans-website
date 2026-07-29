import type { ModelStatus } from "@/types/model";

const MODEL_STATUS_RANK: Record<ModelStatus, number> = {
  active: 0,
  candidate: 1,
  inactive: 2,
  denied: 3,
};

export function normalizeModelStatus(
  status: string | null | undefined,
  active: boolean | null | undefined,
): ModelStatus {
  if (
    status === "active" ||
    status === "inactive" ||
    status === "candidate" ||
    status === "denied"
  ) {
    return status;
  }

  return active ? "active" : "inactive";
}

export function modelStatusRank(
  status: string | null | undefined,
  active: boolean | null | undefined,
): number {
  return MODEL_STATUS_RANK[normalizeModelStatus(status, active)];
}

type ModelStatusSortKey = {
  status: string | null | undefined;
  active: boolean | null | undefined;
  name?: string | null;
};

/**
 * Orders models by status (ativa, candidata, inativa, negada), falling back to
 * the provided name and otherwise preserving the original order.
 */
export function sortByModelStatus<T>(
  items: readonly T[],
  selectKey: (item: T) => ModelStatusSortKey,
): T[] {
  return [...items].sort((first, second) => {
    const firstKey = selectKey(first);
    const secondKey = selectKey(second);

    const rankDifference =
      modelStatusRank(firstKey.status, firstKey.active) -
      modelStatusRank(secondKey.status, secondKey.active);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    if (firstKey.name == null || secondKey.name == null) {
      return 0;
    }

    return firstKey.name.localeCompare(secondKey.name, "pt-BR", {
      sensitivity: "base",
    });
  });
}
