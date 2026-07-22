"use client";

import Link from "next/link";
import { useState } from "react";

import ChecklistTab from "@/components/admin/model/ChecklistTab";
import DocumentsTab from "@/components/admin/model/DocumentsTab";
import DriveTab from "@/components/admin/model/DriveTab";
import FanslyTab from "@/components/admin/model/FanslyTab";
import HistoryTab from "@/components/admin/model/HistoryTab";
import NotesTab from "@/components/admin/model/NotesTab";
import OnlyFansTab from "@/components/admin/model/OnlyFansTab";
import OverviewTab from "@/components/admin/model/OverviewTab";
import PlatformsTab from "@/components/admin/model/PlatformsTab";

import type {
  ManagementRole,
  Model,
  ModelChecklist,
} from "@/types/model";

type ModelAdminClientProps = {
  model: Model;
  checklist: ModelChecklist;
  currentUserRole: ManagementRole;
};

type TabId =
  | "summary"
  | "checklist"
  | "platforms"
  | "onlyfans"
  | "fansly"
  | "drive"
  | "documents"
  | "payments"
  | "notes"
  | "history";

const tabs: Array<{
  id: TabId;
  label: string;
}> = [
  {
    id: "summary",
    label: "Resumo",
  },
  {
    id: "checklist",
    label: "Status",
  },
  {
    id: "platforms",
    label: "Plataformas",
  },
  {
    id: "onlyfans",
    label: "OnlyFans",
  },
  {
    id: "fansly",
    label: "Fansly",
  },
  {
    id: "drive",
    label: "Google Drive",
  },
  {
    id: "documents",
    label: "Documentos",
  },
  {
    id: "payments",
    label: "Pagamentos",
  },
  {
    id: "notes",
    label: "Notas",
  },
  {
    id: "history",
    label: "Histórico",
  },
];

export default function ModelAdminClient({
  model,
  checklist,
  currentUserRole,
}: ModelAdminClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const onboardingPercentage = Math.min(
    Math.max(checklist.onboardingPercentage ?? 0, 0),
    100,
  );

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <Link
          href="/admin/models"
          className="text-sm font-semibold text-pink-300 transition hover:text-pink-200"
        >
          ← Voltar para modelos
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#111115] shadow-2xl">
          <header className="border-b border-pink-400/20 bg-gradient-to-r from-[#4b2438] via-[#321725] to-[#211018] p-6 sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-black/30 text-3xl font-bold">
                  {model.profilePhotoUrl ? (
                    <img
                      src={model.profilePhotoUrl}
                      alt={model.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitial(model.displayName)
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-200">
                    Perfil da modelo
                  </p>

                  <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                    {model.displayName}
                  </h1>

                  <p className="mt-2 text-sm text-white/70">
                    {model.stageName
                      ? `Nome artístico: ${model.stageName}`
                      : "Nome artístico não informado"}
                  </p>

                  <p className="mt-1 text-sm text-white/50">
                    Modelo #{model.modelNumber ?? "—"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeaderStatusCard
                  label="Status"
                  value={model.active ? "Ativa" : "Inativa"}
                  status={model.active ? "completed" : "inactive"}
                />

                <HeaderStatusCard
                  label="Onboarding"
                  value={`${onboardingPercentage}%`}
                  status={
                    onboardingPercentage === 100
                      ? "completed"
                      : onboardingPercentage > 0
                        ? "in_progress"
                        : "not_started"
                  }
                />

                <HeaderStatusCard
                  label="Acesso atual"
                  value={roleLabel(currentUserRole)}
                  status="neutral"
                />
              </div>
            </div>
          </header>

          <nav className="border-b border-white/10 bg-black/20 px-4 pt-4 sm:px-6">
            <div className="flex gap-2 overflow-x-auto pb-4">
              {tabs.map((tab) => {
                const selected = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      selected
                        ? "border-pink-400/50 bg-pink-500/20 text-pink-200"
                        : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-5 sm:p-8">
            {activeTab === "summary" && (
              <OverviewTab
                model={model}
                checklist={checklist}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "checklist" && (
              <ChecklistTab
                modelId={model.id}
                checklist={checklist}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "platforms" && (
              <PlatformsTab
                model={model}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "onlyfans" && (
              <OnlyFansTab
                model={model}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "fansly" && (
              <FanslyTab
                model={model}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "drive" && (
              <DriveTab
                model={model}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "documents" && (
              <DocumentsTab
                model={model}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "payments" && (
              <TemporarySection
                eyebrow="Financeiro"
                title="Pagamentos"
                description="PIX, conta bancária, porcentagens, lançamentos e situação dos pagamentos da modelo."
              />
            )}

            {activeTab === "notes" && (
              <NotesTab
                modelId={model.id}
                currentUserRole={currentUserRole}
              />
            )}

            {activeTab === "history" && (
              <HistoryTab
                modelId={model.id}
                currentUserRole={currentUserRole}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TemporarySection({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-pink-400/30 bg-pink-500/5 p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-2xl font-bold">{title}</h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
        {description}
      </p>
    </section>
  );
}

function HeaderStatusCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status:
    | "completed"
    | "in_progress"
    | "not_started"
    | "inactive"
    | "neutral";
}) {
  const styles = {
    completed:
      "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",

    in_progress:
      "border-yellow-400/30 bg-yellow-500/15 text-yellow-200",

    not_started:
      "border-red-400/30 bg-red-500/15 text-red-200",

    inactive:
      "border-white/15 bg-white/5 text-white/50",

    neutral:
      "border-pink-400/25 bg-black/20 text-pink-100",
  };

  return (
    <div
      className={`min-w-[150px] rounded-2xl border px-4 py-3 ${styles[status]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function getInitial(value: string) {
  const cleanedValue = value.trim();

  if (!cleanedValue) {
    return "?";
  }

  return cleanedValue.charAt(0).toUpperCase();
}

function roleLabel(role: ManagementRole) {
  const labels: Record<ManagementRole, string> = {
    owner: "Proprietário",
    administrator: "Administrador",
    representative: "Representante",
    model: "Modelo",
  };

  return labels[role];
}