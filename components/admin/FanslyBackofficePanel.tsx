"use client";

type ChecklistItem = {
  label: string;
  completed: boolean;
};

type ChecklistSection = {
  title: string;
  items: ChecklistItem[];
};

type BackofficeRole =
  | "owner"
  | "administrator"
  | "staff"
  | "model";

type FanslyBackofficePanelProps = {
  currentUserRole: BackofficeRole;
  checklist: ChecklistSection[];
  onToggle: (
    sectionIndex: number,
    itemIndex: number
  ) => void;
};

const allowedRoles: BackofficeRole[] = [
  "owner",
  "administrator",
];

export default function FanslyBackofficePanel({
  currentUserRole,
  checklist,
  onToggle,
}: FanslyBackofficePanelProps) {
  if (!allowedRoles.includes(currentUserRole)) {
    return null;
  }

  const sectionIndex = checklist.findIndex(
    (section) =>
      section.title.includes("Fansly")
  );

  if (sectionIndex === -1) {
    return null;
  }

  const fanslySection = checklist[sectionIndex];
  const completedItems =
    fanslySection.items.filter(
      (item) => item.completed
    ).length;

  const progress =
    fanslySection.items.length === 0
      ? 0
      : Math.round(
          (completedItems /
            fanslySection.items.length) *
            100
        );

  return (
    <section className="mt-6 rounded-2xl border border-violet-400/20 bg-[#111114] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
            Backoffice restrito
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Fansly — operação da agência
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Esta conta, sua receita e suas
            configurações são visíveis apenas para
            o proprietário e administradores.
          </p>
        </div>

        <span className="w-fit rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-violet-300">
          Owner / Administradores
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Progresso do Fansly
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              {completedItems} de{" "}
              {fanslySection.items.length} concluídos
            </p>
          </div>

          <span className="text-2xl font-bold text-violet-300">
            {progress}%
          </span>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-violet-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {fanslySection.items.map(
          (item, itemIndex) => (
            <label
              key={item.label}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-violet-400/30 hover:bg-white/[0.03]"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() =>
                  onToggle(
                    sectionIndex,
                    itemIndex
                  )
                }
                className="mt-1 h-4 w-4 shrink-0 accent-violet-400"
              />

              <span
                className={
                  item.completed
                    ? "text-sm text-zinc-200"
                    : "text-sm text-zinc-400"
                }
              >
                {item.label}
              </span>
            </label>
          )
        )}
      </div>

      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Receita do Fansly
        </p>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          A receita pertence 100% à agência e não
          será exibida na área de acesso da modelo.
          O controle financeiro será adicionado ao
          painel administrativo.
        </p>
      </div>
    </section>
  );
}