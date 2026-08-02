"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ManagementRole } from "@/types/model";

type Responsibility = "model" | "agency" | "both";

type FieldView = {
  key: string;
  label: string;
  type: string;
  placeholder: string | null;
  options: string[] | null;
  required: boolean;
  linked: string | null;
  linkedLocation: string | null;
  value: string;
};

type ItemView = {
  id: string;
  itemKey: string;
  sectionKey: string;
  title: string;
  description: string | null;
  responsibility: Responsibility;
  completed: boolean;
  completedAt: string | null;
  fields: FieldView[];
  missingRequired: string[];
};

type SectionView = {
  key: string;
  title: string;
  order: number;
  items: ItemView[];
  completed: number;
  total: number;
  percentage: number;
};

type Summary = {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  modelPercentage: number;
  agencyPercentage: number;
};

type OnboardingResponse = {
  sections?: SectionView[];
  summary?: Summary;
  canEdit?: boolean;
  locked?: boolean;
  error?: string;
};

type Filter = "all" | "pending" | "done" | "model" | "agency";

const EMPTY_SUMMARY: Summary = {
  total: 0,
  completed: 0,
  remaining: 0,
  percentage: 0,
  modelPercentage: 0,
  agencyPercentage: 0,
};

async function fetchOnboarding(
  modelId: string,
): Promise<OnboardingResponse> {
  const response = await fetch(
    `/api/models/onboarding?modelId=${encodeURIComponent(modelId)}`,
    { method: "GET", cache: "no-store" },
  );

  const result = (await response.json()) as OnboardingResponse;

  if (!response.ok) {
    throw new Error(result.error ?? "Não foi possível carregar o onboarding.");
  }

  return result;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "done", label: "Concluídos" },
  { id: "model", label: "Modelo" },
  { id: "agency", label: "Agência" },
];

export default function OnboardingChecklistPanel({
  modelId,
  currentUserRole,
  title = "Onboarding OnlyFans",
}: {
  modelId: string;
  currentUserRole: ManagementRole;
  title?: string;
}) {
  const [sections, setSections] = useState<SectionView[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [canEdit, setCanEdit] = useState(false);
  const [locked, setLocked] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>(
    {},
  );

  const applyResponse = useCallback((result: OnboardingResponse) => {
    setSections(result.sections ?? []);
    setSummary(result.summary ?? EMPTY_SUMMARY);
    setCanEdit(result.canEdit === true);
    setLocked(result.locked === true);
  }, []);

  // The fetch is kicked off in the effect but every setState happens in a
  // callback once it resolves, never synchronously in the effect body — the
  // one shape react-hooks/set-state-in-effect accepts, and the one that lets
  // a model switch mid-flight without the stale response landing.
  useEffect(() => {
    let active = true;

    fetchOnboarding(modelId)
      .then((result) => {
        if (!active) return;

        applyResponse(result);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o onboarding.",
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [modelId, applyResponse]);

  const patch = useCallback(
    async (
      key: string,
      payload: Record<string, unknown>,
    ): Promise<boolean> => {
      setSavingKey(key);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/models/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, ...payload }),
        });

        const result = (await response.json()) as OnboardingResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Não foi possível salvar.");
        }

        applyResponse(result);

        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível salvar.",
        );

        return false;
      } finally {
        setSavingKey(null);
      }
    },
    [modelId, applyResponse],
  );

  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        visibleItems: section.items.filter((item) => {
          if (filter === "pending") return !item.completed;
          if (filter === "done") return item.completed;
          if (filter === "model") {
            return (
              item.responsibility === "model" || item.responsibility === "both"
            );
          }
          if (filter === "agency") {
            return (
              item.responsibility === "agency" || item.responsibility === "both"
            );
          }
          return true;
        }),
      }))
      .filter((section) => section.visibleItems.length > 0);
  }, [sections, filter]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
        <p className="text-sm text-white/55">Carregando onboarding...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              Processo completo
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              Marque cada etapa e preencha os campos conforme o processo avança.
              A porcentagem se atualiza sozinha a cada caixa marcada.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-4 xl:max-w-2xl">
            <SummaryCard label="Progresso" value={`${summary.percentage}%`} />
            <SummaryCard label="Total" value={summary.total} />
            <SummaryCard
              label="Concluídas"
              value={summary.completed}
              status="success"
            />
            <SummaryCard
              label="Restantes"
              value={summary.remaining}
              status={summary.remaining === 0 ? "success" : "warning"}
            />
          </div>
        </div>

        <div className="mt-6 h-4 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              summary.percentage === 100 ? "bg-emerald-400" : "bg-pink-400"
            }`}
            style={{ width: `${summary.percentage}%` }}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ProgressBar
            label="Responsabilidade da modelo"
            value={summary.modelPercentage}
          />
          <ProgressBar
            label="Responsabilidade da agência"
            value={summary.agencyPercentage}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/45">
            {summary.completed} de {summary.total} etapas concluídas
          </p>

          {locked && (
            <p className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
              Onboarding concluído
              {currentUserRole === "owner"
                ? " — apenas você pode editar"
                : " — bloqueado, apenas o proprietário pode editar"}
            </p>
          )}

          {!locked && !canEdit && (
            <p className="text-xs font-semibold text-yellow-200">
              Visualização somente
            </p>
          )}
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              filter === option.id
                ? "border-pink-400 bg-pink-400 text-black"
                : "border-white/10 bg-black/20 text-white/55 hover:border-pink-400/40 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visibleSections.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
          <p className="text-sm text-white/55">
            Nenhuma etapa corresponde ao filtro selecionado.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {visibleSections.map((section) => {
            const isOpen = !closedSections[section.key];

            return (
              <section
                key={section.key}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  onClick={() =>
                    setClosedSections((current) => ({
                      ...current,
                      [section.key]: !current[section.key],
                    }))
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
                      {section.completed} de {section.total} concluídas
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        section.percentage === 100
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border-pink-400/30 bg-pink-500/10 text-pink-200"
                      }`}
                    >
                      {section.percentage}%
                    </span>

                    <span className="text-xl text-white/50">
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10">
                    {section.visibleItems.map((item) => (
                      <ItemRow
                        key={item.itemKey}
                        item={item}
                        canEdit={canEdit}
                        isSaving={savingKey === item.itemKey}
                        savingKey={savingKey}
                        onToggle={(completed) =>
                          patch(item.itemKey, {
                            itemKey: item.itemKey,
                            completed,
                          })
                        }
                        onSaveField={(fieldKey, value) =>
                          patch(`${item.itemKey}.${fieldKey}`, {
                            itemKey: item.itemKey,
                            field: { key: fieldKey, value },
                          })
                        }
                      />
                    ))}
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

function ItemRow({
  item,
  canEdit,
  isSaving,
  savingKey,
  onToggle,
  onSaveField,
}: {
  item: ItemView;
  canEdit: boolean;
  isSaving: boolean;
  savingKey: string | null;
  onToggle: (completed: boolean) => Promise<boolean>;
  onSaveField: (fieldKey: string, value: string) => Promise<boolean>;
}) {
  const blocked = item.missingRequired.length > 0 && !item.completed;

  return (
    <div
      className={`border-b border-white/10 px-5 py-5 last:border-b-0 sm:px-6 ${
        item.completed ? "bg-emerald-500/[0.04]" : ""
      }`}
    >
      <div className="flex gap-4">
        <button
          type="button"
          disabled={!canEdit || isSaving || blocked}
          onClick={() => void onToggle(!item.completed)}
          aria-label={
            item.completed ? "Marcar como pendente" : "Marcar como concluída"
          }
          title={
            blocked
              ? `Preencha antes: ${item.missingRequired.join(", ")}`
              : undefined
          }
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-black transition ${
            item.completed
              ? "border-emerald-400 bg-emerald-400 text-black"
              : "border-white/25 bg-white/5 text-transparent hover:border-pink-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isSaving ? "…" : item.completed ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4
                className={`text-sm font-bold ${
                  item.completed ? "text-emerald-200" : "text-white"
                }`}
              >
                {item.title}
              </h4>

              {item.description && (
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/45">
                  {item.description}
                </p>
              )}
            </div>

            <ResponsibilityBadge responsibility={item.responsibility} />
          </div>

          {item.fields.length > 0 && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {item.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  disabled={!canEdit}
                  isSaving={savingKey === `${item.itemKey}.${field.key}`}
                  onSave={(value) => onSaveField(field.key, value)}
                />
              ))}
            </div>
          )}

          {blocked && (
            <p className="mt-3 text-xs font-semibold text-yellow-200">
              Preencha para poder concluir: {item.missingRequired.join(", ")}
            </p>
          )}

          {item.completed && item.completedAt && (
            <p className="mt-3 text-xs font-semibold text-emerald-300/75">
              Concluída em {formatDateTime(item.completedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Saves on blur, and only when the value actually changed — the checklist is
 * filled in field by field, not through a form with a submit button.
 */
function FieldInput({
  field,
  disabled,
  isSaving,
  onSave,
}: {
  field: FieldView;
  disabled: boolean;
  isSaving: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(field.value);
  const [saved, setSaved] = useState(false);

  // A save re-reads the whole checklist, so the value can change underneath
  // this input — including from someone editing the same linked field in the
  // tab it mirrors. Adjusting during render rather than in an effect is
  // React's documented way to follow a prop without a cascading render.
  const [serverValue, setServerValue] = useState(field.value);

  if (serverValue !== field.value) {
    setServerValue(field.value);
    setValue(field.value);
  }

  async function commit() {
    const next = value.trim();

    if (next === field.value.trim()) {
      return;
    }

    const ok = await onSave(next);

    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } else {
      setValue(field.value);
    }
  }

  const inputClassName =
    "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-400/60 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <label className="block">
      <span className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
        {field.label}

        {field.required && <span className="text-pink-300">obrigatório</span>}

        {field.linkedLocation && (
          <span
            className="rounded-full border border-blue-400/25 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold normal-case tracking-normal text-blue-200"
            title={`Este campo é o mesmo de ${field.linkedLocation} — salvar aqui atualiza lá, e vice-versa.`}
          >
            também em {field.linkedLocation}
          </span>
        )}

        {isSaving && <span className="text-white/35">salvando…</span>}
        {saved && !isSaving && (
          <span className="text-emerald-300">salvo</span>
        )}
      </span>

      <span className="mt-2 block">
        {field.type === "textarea" ? (
          <textarea
            value={value}
            disabled={disabled}
            rows={3}
            placeholder={field.placeholder ?? ""}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void commit()}
            className={inputClassName}
          />
        ) : field.type === "select" ? (
          <select
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void commit()}
            className={inputClassName}
          >
            <option value="">Não informado</option>

            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={
              field.type === "date"
                ? "date"
                : field.type === "email"
                  ? "email"
                  : field.type === "url"
                    ? "url"
                    : field.type === "tel"
                      ? "tel"
                      : "text"
            }
            value={value}
            disabled={disabled}
            placeholder={field.placeholder ?? ""}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void commit()}
            className={inputClassName}
          />
        )}
      </span>
    </label>
  );
}

function ResponsibilityBadge({
  responsibility,
}: {
  responsibility: Responsibility;
}) {
  const config: Record<Responsibility, { label: string; className: string }> = {
    model: {
      label: "Modelo",
      className: "border-blue-400/30 bg-blue-500/10 text-blue-200",
    },
    agency: {
      label: "Agência",
      className: "border-pink-400/30 bg-pink-500/10 text-pink-200",
    },
    both: {
      label: "Ambos",
      className: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
    },
  };

  const selected = config[responsibility];

  return (
    <span
      className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${selected.className}`}
    >
      {selected.label}
    </span>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-white/55">{label}</span>
        <span className="font-bold text-pink-300">{value}%</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-pink-400 transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  status = "default",
}: {
  label: string;
  value: string | number;
  status?: "default" | "success" | "warning";
}) {
  const styles = {
    default: "border-white/10 bg-white/[0.03] text-pink-300",
    success: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    warning: "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles[status]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
