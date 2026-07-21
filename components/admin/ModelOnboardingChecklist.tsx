"use client";

import { useMemo, useState } from "react";

type ChecklistItem = {
  label: string;
  completed: boolean;
};

type ChecklistSection = {
  title: string;
  items: ChecklistItem[];
};

type Responsibility = "Modelo" | "Agência" | "Ambos";
type ChecklistFilter =
  | "Todos"
  | "Pendentes"
  | "Concluídos"
  | "Modelo"
  | "Agência";

type ModelOnboardingChecklistProps = {
  checklist: ChecklistSection[];
  onToggle: (
    sectionIndex: number,
    itemIndex: number
  ) => void;
  onReset: () => void;
};

type OnboardingProgressPanelProps = {
  checklist: ChecklistSection[];
  latestNote: string;
};

const agencySections = new Set([
  "5. Configuração do Fansly",
  "6. Otimização do perfil",
  "8. Marketing e promoção",
  "10. Analytics e melhoria contínua",
]);

const modelSections = new Set([
  "1. Informações da modelo",
  "2. Verificação da conta",
  "3. Configuração bancária",
  "7. Estratégia de conteúdo",
]);

function getResponsibility(
  sectionTitle: string,
  itemLabel: string
): Responsibility {
  if (agencySections.has(sectionTitle)) {
    return "Agência";
  }

  if (modelSections.has(sectionTitle)) {
    if (
      itemLabel.includes("Google Drive") ||
      itemLabel.includes("Login do site")
    ) {
      return "Agência";
    }

    return "Modelo";
  }

  if (
    sectionTitle.includes("OnlyFans") ||
    sectionTitle.includes("Fansly") ||
    sectionTitle.includes("Reddit") ||
    sectionTitle.includes("X / Twitter") ||
    sectionTitle.includes("Instagram") ||
    sectionTitle.includes("TikTok") ||
    sectionTitle.includes("YouTube") ||
    sectionTitle.includes("Facebook") ||
    sectionTitle.includes("Documentos legais")
  ) {
    return "Ambos";
  }

  return "Ambos";
}

function getSectionLabel(
  sectionTitle: string
) {
  if (sectionTitle.includes("OnlyFans")) {
    return "ONLYFANS — CONTA DA MODELO";
  }

  if (sectionTitle.includes("Fansly")) {
    return "FANSLY — BACKOFFICE DA AGÊNCIA";
  }

  return null;
}

function calculateProgress(
  items: ChecklistItem[]
) {
  if (items.length === 0) {
    return 0;
  }

  const completed = items.filter(
    (item) => item.completed
  ).length;

  return Math.round(
    (completed / items.length) * 100
  );
}

function getProgressData(
  checklist: ChecklistSection[]
) {
  const allItems = checklist.flatMap(
    (section) => section.items
  );

  const modelItems = checklist.flatMap(
    (section) =>
      section.items.filter((item) => {
        const responsibility =
          getResponsibility(
            section.title,
            item.label
          );

        return (
          responsibility === "Modelo" ||
          responsibility === "Ambos"
        );
      })
  );

  const agencyItems = checklist.flatMap(
    (section) =>
      section.items.filter((item) => {
        const responsibility =
          getResponsibility(
            section.title,
            item.label
          );

        return (
          responsibility === "Agência" ||
          responsibility === "Ambos"
        );
      })
  );

  const onlyFansItems =
    checklist.find((section) =>
      section.title.includes("OnlyFans")
    )?.items ?? [];

  const fanslyItems =
    checklist.find((section) =>
      section.title.includes("Fansly")
    )?.items ?? [];

  return {
    overall: calculateProgress(allItems),
    model: calculateProgress(modelItems),
    agency: calculateProgress(agencyItems),
    onlyFans: calculateProgress(onlyFansItems),
    fansly: calculateProgress(fanslyItems),
    total: allItems.length,
    completed: allItems.filter(
      (item) => item.completed
    ).length,
  };
}

export function OnboardingProgressPanel({
  checklist,
  latestNote,
}: OnboardingProgressPanelProps) {
  const progress = useMemo(
    () => getProgressData(checklist),
    [checklist]
  );

  return (
    <section className="rounded-2xl border border-pink-400/20 bg-[#111114] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300">
        Onboarding
      </p>

      <h2 className="mt-2 text-2xl font-bold">
        Progresso
      </h2>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <PlatformProgressCard
          label="OnlyFans — modelo"
          value={progress.onlyFans}
          access="Receita compartilhada"
        />

        <PlatformProgressCard
          label="Fansly — agência"
          value={progress.fansly}
          access="Owner e administradores"
        />
      </div>

      <div className="mt-7">
        <ProgressBar
          label="Progresso total"
          value={progress.overall}
          large
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <ProgressBar
          label="Responsabilidade da modelo"
          value={progress.model}
        />

        <ProgressBar
          label="Responsabilidade da agência"
          value={progress.agency}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <SummaryBox
          label="Concluídos"
          value={progress.completed}
        />

        <SummaryBox
          label="Total"
          value={progress.total}
        />
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Última nota
        </p>

        <p className="mt-2 leading-6 text-zinc-200">
          {latestNote}
        </p>
      </div>
    </section>
  );
}

export default function ModelOnboardingChecklist({
  checklist,
  onToggle,
  onReset,
}: ModelOnboardingChecklistProps) {
  const [filter, setFilter] =
    useState<ChecklistFilter>("Todos");

  const [openSections, setOpenSections] =
    useState<string[]>(() =>
      checklist.map((section) => section.title)
    );

  const filteredSections = useMemo(() => {
    return checklist
      .filter(
        (section) =>
          !section.title.includes("Fansly")
      )
      .map((section) => ({
        ...section,
        indexedItems: section.items
          .map((item, itemIndex) => ({
            ...item,
            itemIndex,
            responsibility:
              getResponsibility(
                section.title,
                item.label
              ),
          }))
          .filter((item) => {
            if (filter === "Pendentes") {
              return !item.completed;
            }

            if (filter === "Concluídos") {
              return item.completed;
            }

            if (filter === "Modelo") {
              return (
                item.responsibility ===
                  "Modelo" ||
                item.responsibility ===
                  "Ambos"
              );
            }

            if (filter === "Agência") {
              return (
                item.responsibility ===
                  "Agência" ||
                item.responsibility ===
                  "Ambos"
              );
            }

            return true;
          }),
      }))
      .filter(
        (section) =>
          section.indexedItems.length > 0
      );
  }, [checklist, filter]);

  function toggleSection(title: string) {
    setOpenSections((current) =>
      current.includes(title)
        ? current.filter(
            (item) => item !== title
          )
        : [...current, title]
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-pink-400/20 bg-[#111114] p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300">
            Checklist completo
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Onboarding da modelo
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Acompanhe cada etapa por seção e
            responsabilidade.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-fit rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-red-400 hover:text-red-300"
        >
          Restaurar checklist
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            "Todos",
            "Pendentes",
            "Concluídos",
            "Modelo",
            "Agência",
          ] as ChecklistFilter[]
        ).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              filter === option
                ? "border-pink-400 bg-pink-400 text-black"
                : "border-white/10 bg-black/20 text-zinc-400 hover:border-pink-400/40 hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {filteredSections.map(
          (section) => {
            const originalSectionIndex =
              checklist.findIndex(
                (item) =>
                  item.title === section.title
              );

            const sectionProgress =
              calculateProgress(
                checklist[
                  originalSectionIndex
                ].items
              );

            const isOpen =
              openSections.includes(
                section.title
              );

            return (
              <article
                key={section.title}
                className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleSection(section.title)
                  }
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03]"
                >
                  <div>
                    <h3 className="font-semibold text-pink-200">
                      {section.title}
                    </h3>

                    {getSectionLabel(
                      section.title
                    ) && (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                        {getSectionLabel(
                          section.title
                        )}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-zinc-500">
                      {sectionProgress}% concluído
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-zinc-800 sm:block">
                      <div
                        className="h-full rounded-full bg-pink-400 transition-all"
                        style={{
                          width: `${sectionProgress}%`,
                        }}
                      />
                    </div>

                    <span className="text-xl text-zinc-400">
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 p-5">
                    <div className="grid gap-3 lg:grid-cols-2">
                      {section.indexedItems.map(
                        (item) => (
                          <label
                            key={`${section.title}-${item.label}`}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-4 transition hover:border-pink-400/20 hover:bg-white/[0.04]"
                          >
                            <input
                              type="checkbox"
                              checked={
                                item.completed
                              }
                              onChange={() =>
                                onToggle(
                                  originalSectionIndex,
                                  item.itemIndex
                                )
                              }
                              className="mt-1 h-4 w-4 shrink-0 accent-pink-400"
                            />

                            <span className="min-w-0 flex-1">
                              <span
                                className={
                                  item.completed
                                    ? "block text-sm text-zinc-200"
                                    : "block text-sm text-zinc-400"
                                }
                              >
                                {item.label}
                              </span>

                              <ResponsibilityBadge
                                responsibility={
                                  item.responsibility
                                }
                              />
                            </span>
                          </label>
                        )
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          }
        )}

        {filteredSections.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center text-sm text-zinc-500">
            Nenhum item corresponde ao filtro
            selecionado.
          </div>
        )}
      </div>
    </section>
  );
}

function PlatformProgressCard({
  label,
  value,
  access,
}: {
  label: string;
  value: number;
  access: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {label}
          </p>

          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
            {access}
          </p>
        </div>

        <span className="text-xl font-bold text-pink-300">
          {value}%
        </span>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-pink-400 transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  large = false,
}: {
  label: string;
  value: number;
  large?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-400">
          {label}
        </span>

        <span
          className={
            large
              ? "text-2xl font-bold text-pink-300"
              : "font-bold text-pink-300"
          }
        >
          {value}%
        </span>
      </div>

      <div
        className={`overflow-hidden rounded-full bg-zinc-800 ${
          large ? "h-4" : "h-3"
        }`}
      >
        <div
          className="h-full rounded-full bg-pink-400 transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
      <p className="text-xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function ResponsibilityBadge({
  responsibility,
}: {
  responsibility: Responsibility;
}) {
  const classes =
    responsibility === "Modelo"
      ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
      : responsibility === "Agência"
        ? "border-red-400/30 bg-red-400/10 text-red-300"
        : "border-blue-400/30 bg-blue-400/10 text-blue-300";

  return (
    <span
      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${classes}`}
    >
      {responsibility}
    </span>
  );
}