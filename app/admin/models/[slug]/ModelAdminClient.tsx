"use client";

import { useTranslations } from "next-intl";

import NotesTab from "@/components/admin/model/NotesTab";
import DocumentsTab from "@/components/admin/model/DocumentsTab";
import OnlyFansTab from "@/components/admin/model/OnlyFansTab";
import PlatformsTab from "@/components/admin/model/PlatformsTab";
import OverviewTab from "@/components/admin/model/OverviewTab";
import ModelProxyPanel from "@/components/admin/model/ModelProxyPanel";
import ModelCredentialsReset from "@/components/admin/model/ModelCredentialsReset";
import ModelAvatarEditor from "@/components/admin/model/ModelAvatarEditor";
import ChecklistTab from "@/components/admin/model/ChecklistTab";
import DailyTab from "@/components/admin/model/DailyTab";
import EarningsTab from "@/components/admin/model/EarningsTab";
import PaymentsTab from "@/components/admin/model/PaymentsTab";
import BrandGrowthTab from "@/components/brand/BrandGrowthTab";
import HistoryTab from "@/components/admin/model/HistoryTab";

import { useState } from "react";
import Link from "next/link";

import ReassignRepresentativePanel from "@/components/admin/model/ReassignRepresentativePanel";
import { isStaffRole } from "@/lib/auth/roles";

import type {
    ManagementRole,
    Model,
    ModelChecklist,
    ModelProxyDetails,
} from "@/types/model";

type RepresentativeOption = {
    id: string;
    fullName: string;
    role: string;
};

type ModelAdminClientProps = {
    model: Model;
    checklist: ModelChecklist;
    currentUserRole: ManagementRole;
    proxyDetails: ModelProxyDetails;
    /**
     * What she signs in with — a username or an e-mail address — resolved
     * server-side from auth.users. Null when she has no login yet.
     */
    currentLogin: string | null;
    representatives: RepresentativeOption[];
};

type TabId =
    | "summary"
    | "daily"
    | "checklist"
    | "platforms"
    | "onlyfans"
    | "fansly"
    | "documents"
    | "earnings"
    | "payments"
    | "notes"
    | "history"
    | "brand_growth";

/** The id doubles as the key under `admin.modelPage.tabs`. */
const tabs: {
    id: TabId;
}[] = [
        { id: "summary" },
        { id: "daily" },
        { id: "checklist" },
        { id: "platforms" },
        { id: "onlyfans" },
        { id: "fansly" },
        { id: "documents" },
        { id: "earnings" },
        { id: "payments" },
        { id: "notes" },
        { id: "history" },
        { id: "brand_growth" },
    ];

export default function ModelAdminClient({
    model: initialModel,
    checklist,
    currentUserRole,
    proxyDetails,
    currentLogin,
    representatives,
}: ModelAdminClientProps) {
    const t = useTranslations("admin.modelPage");
    const tStatus = useTranslations("enums.modelStatus");
    const tRole = useTranslations("enums.role");

    const [activeTab, setActiveTab] =
        useState<TabId>("summary");

    const [model, setModel] =
        useState<Model>(initialModel);

    const onboardingPercentage = Math.min(
        Math.max(checklist.onboardingPercentage, 0),
        100,
    );

    return (
        <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
            <div className="mx-auto max-w-[1600px]">
                <Link
                    href="/admin/models"
                    className="text-sm font-semibold text-pink-300 transition hover:text-pink-200"
                >
                    {t("backToModels")}
                </Link>

                <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#111115] shadow-2xl">
                    <header className="border-b border-pink-400/20 bg-gradient-to-r from-[#4b2438] via-[#321725] to-[#211018] p-6 sm:p-8">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                                <ModelAvatarEditor
                                    modelId={model.id}
                                    modelName={model.fullName}
                                    profilePhotoUrl={
                                        model.profilePhotoUrl
                                    }
                                    onPhotoChange={(url) =>
                                        setModel((current) => ({
                                            ...current,
                                            profilePhotoUrl: url,
                                        }))
                                    }
                                />

                                <div className="flex flex-1 items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-200">
                                            {t("profileEyebrow")}
                                        </p>

                                        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                                            {model.fullName}
                                        </h1>

                                        <p className="mt-2 text-sm text-white/70">
                                            {model.stageName
                                                ? t("stageNameLine", {
                                                    name: model.stageName,
                                                })
                                                : t("noStageName")}
                                        </p>

                                        <p className="mt-1 text-sm text-white/50">
                                            {t("modelNumberLine", {
                                                number:
                                                    model.modelNumber ?? "—",
                                            })}
                                        </p>
                                    </div>

                                    <ModelCredentialsReset
                                        modelId={model.id}
                                        modelName={model.fullName}
                                        currentEmail={model.email}
                                        currentLogin={currentLogin}
                                        whatsapp={model.whatsapp}
                                        hasLogin={Boolean(
                                            model.profileId,
                                        )}
                                    />
                                </div>

                                <div className="w-full sm:w-72">
                                    <ModelProxyPanel
                                        modelId={model.id}
                                        proxyDetails={proxyDetails}
                                        canEdit={
                                            currentUserRole === "owner"
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <HeaderStatusCard
                                    label={t("fields.status")}
                                    value={
                                        model.active
                                            ? tStatus("active")
                                            : tStatus("inactive")
                                    }
                                    status={
                                        model.active
                                            ? "completed"
                                            : "inactive"
                                    }
                                />

                                <HeaderStatusCard
                                    label={t("fields.onboarding")}
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
                                    label={t("fields.currentAccess")}
                                    value={tRole(currentUserRole)}
                                    status="neutral"
                                />
                            </div>
                        </div>
                    </header>

                    <nav className="border-b border-white/10 bg-black/20 px-4 pt-4 sm:px-6">
                        <div className="flex gap-2 overflow-x-auto pb-4">
                            {tabs
                            .filter((tab) =>
                                tab.id !== "brand_growth" ||
                                currentUserRole === "owner" ||
                                currentUserRole === "administrator",
                            )
                            .map((tab) => {
                                const selected =
                                    activeTab === tab.id;

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() =>
                                            setActiveTab(tab.id)
                                        }
                                        className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${selected
                                            ? "border-pink-400/50 bg-pink-500/20 text-pink-200"
                                            : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                                            }`}
                                    >
                                        {t(`tabs.${tab.id}`)}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>

                    <div className="p-5 sm:p-8">
                        {activeTab === "summary" && (
                            <>
                                <OverviewTab
                                    model={model}
                                    checklist={checklist}
                                    currentUserRole={currentUserRole}
                                    onModelUpdate={setModel}
                                />

                                <div className="mt-8">
                                    <ReassignRepresentativePanel
                                        modelId={model.id}
                                        currentRepresentativeId={model.representativeId}
                                        representatives={representatives}
                                        canReassign={isStaffRole(currentUserRole)}
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === "daily" && (
                            <DailyTab
                                modelId={model.id}
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
                            <TemporarySection
                                title="Fansly"
                                description={t("fanslyDescription")}
                            />
                        )}

                        {activeTab === "documents" && (
                            <DocumentsTab
                                model={model}
                                currentUserRole={currentUserRole}
                            />
                        )}

                        {activeTab === "earnings" && (
                            <EarningsTab model={model} />
                        )}

                        {activeTab === "payments" && (
                            <PaymentsTab
                                modelId={model.id}
                                currentUserRole={currentUserRole}
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

                        {activeTab === "brand_growth" && (
                            <BrandGrowthTab model={model} />
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

function TemporarySection({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    const t = useTranslations("admin.modelPage");

    return (
        <section className="rounded-2xl border border-dashed border-pink-400/30 bg-pink-500/5 p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
                {t("stepThree")}
            </p>

            <h2 className="mt-3 text-2xl font-bold">
                {title}
            </h2>

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

            <p className="mt-1 text-sm font-bold">
                {value}
            </p>
        </div>
    );
}
