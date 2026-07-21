"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ManagementRole } from "@/types/model";

type ChecklistTabProps = {
  modelId: string;
  checklist?: unknown;
  currentUserRole: ManagementRole;
};

type Responsibility =
  | "model"
  | "agency"
  | "both";

type OnboardingItem = {
  id: string;
  model_id: string;
  item_key: string;
  platform: string;
  section_key: string;
  section_title: string;
  section_order: number;
  item_title: string;
  item_description: string | null;
  item_order: number;
  responsibility: Responsibility;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OnboardingSummary = {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
};

type OnboardingResponse = {
  items?: OnboardingItem[];
  summary?: OnboardingSummary;
  canEdit?: boolean;
  error?: string;
};

type UpdateResponse = {
  item?: OnboardingItem;
  summary?: OnboardingSummary;
  error?: string;
};

type OnboardingSection = {
  key: string;
  title: string;
  order: number;
  items: OnboardingItem[];
};

const EMPTY_SUMMARY: OnboardingSummary = {
  total: 0,
  completed: 0,
  remaining: 0,
  percentage: 0,
};

export default function ChecklistTab({
  modelId,
  currentUserRole,
}: ChecklistTabProps) {
  const [items, setItems] = useState<
    OnboardingItem[]
  >([]);

  const [summary, setSummary] =
    useState<OnboardingSummary>(
      EMPTY_SUMMARY,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [loadingItemId, setLoadingItemId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [openSections, setOpenSections] =
    useState<Record<string, boolean>>({});

  const canEdit =
    currentUserRole === "owner" ||
    currentUserRole ===
      "administrator";

  const loadOnboarding = useCallback(
    async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/models/onboarding?modelId=${encodeURIComponent(
            modelId,
          )}&platform=onlyfans`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as OnboardingResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Não foi possível carregar o onboarding.",
          );
        }

        const receivedItems =
          result.items ?? [];

        setItems(receivedItems);

        setSummary(
          result.summary ??
            EMPTY_SUMMARY,
        );

        const initialOpenSections:
          Record<string, boolean> = {};

        for (const item of receivedItems) {
          if (
            initialOpenSections[
              item.section_key
            ] === undefined
          ) {
            initialOpenSections[
              item.section_key
            ] = true;
          }
        }

        setOpenSections(
          initialOpenSections,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o onboarding.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [modelId],
  );

  useEffect(() => {
    void loadOnboarding();
  }, [loadOnboarding]);

  const sections =
    useMemo<OnboardingSection[]>(() => {
      const sectionMap = new Map<
        string,
        OnboardingSection
      >();

      for (const item of items) {
        const existing =
          sectionMap.get(
            item.section_key,
          );

        if (existing) {
          existing.items.push(item);
          continue;
        }

        sectionMap.set(
          item.section_key,
          {
            key: item.section_key,
            title: item.section_title,
            order: item.section_order,
            items: [item],
          },
        );
      }

      return Array.from(
        sectionMap.values(),
      )
        .sort(
          (a, b) =>
            a.order - b.order,
        )
        .map((section) => ({
          ...section,
          items: [...section.items].sort(
            (a, b) =>
              a.item_order -
              b.item_order,
          ),
        }));
    }, [items]);

  async function toggleItem(
    item: OnboardingItem,
  ) {
    if (
      !canEdit ||
      loadingItemId
    ) {
      return;
    }

    const newCompletedValue =
      !item.completed;

    setLoadingItemId(item.id);
    setErrorMessage(null);

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              completed:
                newCompletedValue,
            }
          : currentItem,
      ),
    );

    try {
      const response = await fetch(
        "/api/models/onboarding",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            modelId,
            itemId: item.id,
            completed:
              newCompletedValue,
          }),
        },
      );

      const result =
        (await response.json()) as UpdateResponse;

      if (
        !response.ok ||
        !result.item
      ) {
        throw new Error(
          result.error ??
            "Não foi possível atualizar esta etapa.",
        );
      }

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id ===
          result.item?.id
            ? result.item
            : currentItem,
        ),
      );

      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (error) {
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                completed:
                  item.completed,
              }
            : currentItem,
        ),
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar esta etapa.",
      );
    } finally {
      setLoadingItemId(null);
    }
  }

  function toggleSection(
    sectionKey: string,
  ) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]:
        !current[sectionKey],
    }));
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
        <p className="text-sm text-white/55">
          Carregando onboarding...
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              Processo completo
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Onboarding OnlyFans
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              Marque cada etapa conforme o
              processo de criação, verificação,
              configuração e lançamento da conta
              for concluído.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-4 xl:max-w-3xl">
            <SummaryCard
              label="Progresso"
              value={`${summary.percentage}%`}
            />

            <SummaryCard
              label="Total"
              value={summary.total}
            />

            <SummaryCard
              label="Concluídas"
              value={summary.completed}
              status="success"
            />

            <SummaryCard
              label="Restantes"
              value={summary.remaining}
              status={
                summary.remaining === 0
                  ? "success"
                  : "warning"
              }
            />
          </div>
        </div>

        <div className="mt-6 h-4 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              summary.percentage === 100
                ? "bg-emerald-400"
                : "bg-pink-400"
            }`}
            style={{
              width: `${summary.percentage}%`,
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs text-white/45">
            {summary.completed} de{" "}
            {summary.total} etapas concluídas
          </p>

          {!canEdit && (
            <p className="text-xs font-semibold text-yellow-200">
              Visualização somente
            </p>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {sections.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
          <p className="text-sm text-white/55">
            Nenhuma etapa de onboarding foi
            encontrada para esta modelo.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const sectionCompleted =
              section.items.filter(
                (item) => item.completed,
              ).length;

            const sectionPercentage =
              section.items.length === 0
                ? 0
                : Math.round(
                    (sectionCompleted /
                      section.items.length) *
                      100,
                  );

            const isOpen =
              openSections[
                section.key
              ] ?? true;

            return (
              <section
                key={section.key}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleSection(
                      section.key,
                    )
                  }
                  className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left transition hover:bg-white/[0.03] sm:px-6"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-300">
                      Etapa {section.order}
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-white">
                      {section.title}
                    </h3>

                    <p className="mt-1 text-sm text-white/45">
                      {sectionCompleted} de{" "}
                      {section.items.length} concluídas
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        sectionPercentage ===
                        100
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border-pink-400/30 bg-pink-500/10 text-pink-200"
                      }`}
                    >
                      {sectionPercentage}%
                    </span>

                    <span className="text-xl text-white/50">
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10">
                    {section.items.map(
                      (item) => (
                        <OnboardingItemRow
                          key={item.id}
                          item={item}
                          canEdit={canEdit}
                          isSaving={
                            loadingItemId ===
                            item.id
                          }
                          onToggle={() =>
                            void toggleItem(
                              item,
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OnboardingItemRow({
  item,
  canEdit,
  isSaving,
  onToggle,
}: {
  item: OnboardingItem;
  canEdit: boolean;
  isSaving: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex gap-4 border-b border-white/10 px-5 py-5 last:border-b-0 sm:px-6 ${
        item.completed
          ? "bg-emerald-500/[0.04]"
          : ""
      }`}
    >
      <button
        type="button"
        disabled={!canEdit || isSaving}
        onClick={onToggle}
        aria-label={
          item.completed
            ? "Marcar como não concluída"
            : "Marcar como concluída"
        }
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-black transition ${
          item.completed
            ? "border-emerald-400 bg-emerald-400 text-black"
            : "border-white/25 bg-white/5 text-transparent hover:border-pink-300"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isSaving
          ? "…"
          : item.completed
            ? "✓"
            : ""}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4
              className={`text-sm font-bold ${
                item.completed
                  ? "text-emerald-200"
                  : "text-white"
              }`}
            >
              {item.item_title}
            </h4>

            {item.item_description && (
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/45">
                {item.item_description}
              </p>
            )}
          </div>

          <ResponsibilityBadge
            responsibility={
              item.responsibility
            }
          />
        </div>

        {item.completed &&
          item.completed_at && (
            <p className="mt-3 text-xs font-semibold text-emerald-300/75">
              Concluída em{" "}
              {formatDateTime(
                item.completed_at,
              )}
            </p>
          )}
      </div>
    </div>
  );
}

function ResponsibilityBadge({
  responsibility,
}: {
  responsibility: Responsibility;
}) {
  const config: Record<
    Responsibility,
    {
      label: string;
      className: string;
    }
  > = {
    model: {
      label: "Modelo",
      className:
        "border-blue-400/30 bg-blue-500/10 text-blue-200",
    },
    agency: {
      label: "Agência",
      className:
        "border-pink-400/30 bg-pink-500/10 text-pink-200",
    },
    both: {
      label: "Ambos",
      className:
        "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
    },
  };

  const selected =
    config[responsibility];

  return (
    <span
      className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${selected.className}`}
    >
      {selected.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  status = "default",
}: {
  label: string;
  value: string | number;
  status?:
    | "default"
    | "success"
    | "warning";
}) {
  const styles = {
    default:
      "border-white/10 bg-white/[0.03] text-pink-300",
    success:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    warning:
      "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${styles[status]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}

function formatDateTime(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}