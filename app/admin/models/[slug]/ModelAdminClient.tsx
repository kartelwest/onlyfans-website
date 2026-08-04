"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatCalendarDate } from "@/lib/earnings/period";
import { toLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/models/formatDateTime";

import NotesTab from "@/components/admin/model/NotesTab";
import DocumentsTab from "@/components/admin/model/DocumentsTab";
import OnlyFansTab from "@/components/admin/model/OnlyFansTab";
import PlatformsTab from "@/components/admin/model/PlatformsTab";
import OverviewTab from "@/components/admin/model/OverviewTab";
import ModelProxyPanel from "@/components/admin/model/ModelProxyPanel";
import ModelCredentialsReset from "@/components/admin/model/ModelCredentialsReset";
import ModelAvatarEditor from "@/components/admin/model/ModelAvatarEditor";
import ChecklistTab from "@/components/admin/model/ChecklistTab";
import EarningsTab from "@/components/admin/model/EarningsTab";
import PaymentsTab from "@/components/admin/model/PaymentsTab";
import BrandGrowthTab from "@/components/brand/BrandGrowthTab";
import HistoryTab from "@/components/admin/model/HistoryTab";

import { useState } from "react";
import Link from "next/link";

import ReassignRepresentativePanel from "@/components/admin/model/ReassignRepresentativePanel";
import { isStaffRole } from "@/lib/auth/roles";

import type {
    ChecklistStatus,
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
    | "checklist"
    | "platforms"
    | "onlyfans"
    | "fansly"
    | "drive"
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
        { id: "checklist" },
        { id: "platforms" },
        { id: "onlyfans" },
        { id: "fansly" },
        { id: "drive" },
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
                    ← Voltar para modelos
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
                                            Perfil da modelo
                                        </p>

                                        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                                            {model.fullName}
                                        </h1>

                                        <p className="mt-2 text-sm text-white/70">
                                            {model.stageName
                                                ? `Nome artístico: ${model.stageName}`
                                                : t("noStageName")}
                                        </p>

                                        <p className="mt-1 text-sm text-white/50">
                                            Modelo #{model.modelNumber ?? "—"}
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

                        {activeTab === "drive" && (
                            <TemporarySection
                                title="Google Drive"
                                description={t("driveDescription")}
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

function SummarySection({
    model,
    checklist,
}: {
    model: Model;
    checklist: ModelChecklist;
}) {
    const t = useTranslations("admin.modelPage");
    const tState = useTranslations("common.states");
    const locale = toLocale(useLocale());

    const notInformed = tState("notInformed");
    const never = t("never");

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-white/10 bg-black/20 p-6 lg:col-span-2">
                <SectionHeading
                    eyebrow={t("sections.info")}
                    title={t("sections.mainData")}
                />

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <InfoItem
                        label={t("fields.fullName")}
                        value={model.fullName}
                    />

                    <InfoItem
                        label={t("fields.stageName")}
                        value={showValue(model.stageName, notInformed)}
                    />

                    <InfoItem
                        label={t("fields.birthday")}
                        value={formatDate(model.birthday, locale, notInformed)}
                    />

                    <InfoItem
                        label={t("fields.nationality")}
                        value={showValue(model.nationality, notInformed)}
                    />

                    <InfoItem
                        label={t("fields.city")}
                        value={showValue(model.city, notInformed)}
                    />

                    <InfoItem
                        label={t("fields.language")}
                        value={showValue(model.language, notInformed)}
                    />

                    <InfoItem
                        label={t("fields.email")}
                        value={showValue(model.email, notInformed)}
                    />

                    <InfoItem
                        label={t("fields.whatsapp")}
                        value={showValue(model.whatsapp, notInformed)}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <SectionHeading
                    eyebrow={t("sections.progress")}
                    title={t("fields.onboarding")}
                />

                <div className="mt-6">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white/60">
                            Progresso atual
                        </span>

                        <span className="text-xl font-bold text-pink-300">
                            {checklist.onboardingPercentage}%
                        </span>
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                            className={`h-full rounded-full ${checklist.onboardingPercentage === 100
                                ? "bg-emerald-500"
                                : checklist.onboardingPercentage > 0
                                    ? "bg-yellow-400"
                                    : "bg-red-500"
                                }`}
                            style={{
                                width: `${Math.min(
                                    Math.max(
                                        checklist.onboardingPercentage,
                                        0,
                                    ),
                                    100,
                                )}%`,
                            }}
                        />
                    </div>

                    <p className="mt-4 text-sm text-white/60">
                        {checklist.onboardingPercentage === 100
                            ? t("onboardingComplete")
                            : t("onboardingIncomplete")}
                    </p>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <SectionHeading
                    eyebrow={t("sections.accounts")}
                    title={t("tabs.platforms")}
                />

                <div className="mt-5 space-y-3">
                    <SimpleStatusRow
                        label="OnlyFans"
                        value={model.onlyfans}
                    />

                    <SimpleStatusRow
                        label="Fansly"
                        value={model.fansly}
                    />

                    <SimpleStatusRow
                        label="Instagram"
                        value={model.instagram}
                    />

                    <SimpleStatusRow
                        label="X / Twitter"
                        value={model.twitter}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <SectionHeading
                    eyebrow={t("sections.files")}
                    title="Google Drive"
                />

                <div className="mt-5 space-y-3">
                    <DriveLink
                        label="OnlyFans"
                        url={model.driveOnlyfans}
                    />

                    <DriveLink
                        label="Instagram"
                        url={model.driveInstagram}
                    />

                    <DriveLink
                        label="X / Twitter"
                        url={model.driveTwitter}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <SectionHeading
                    eyebrow={t("sections.activity")}
                    title={t("sections.accountRecord")}
                />

                <div className="mt-5 space-y-5">
                    <InfoItem
                        label={t("fields.lastLogin")}
                        value={formatTimestamp(
                            model.lastLoginAt,
                                locale,
                                never,
                        )}
                    />

                    <InfoItem
                        label={t("fields.createdAt")}
                        value={formatTimestamp(
                            model.createdAt,
                                locale,
                                never,
                        )}
                    />

                    <InfoItem
                        label={t("fields.updatedAt")}
                        value={formatTimestamp(
                            model.updatedAt,
                                locale,
                                never,
                        )}
                    />
                </div>
            </section>
        </div>
    );
}

function ChecklistSection({
    checklist,
}: {
    checklist: ModelChecklist;
}) {
    const t = useTranslations("admin.modelPage");
    const tItems = useTranslations("admin.modelPage.checklistItems");

    const checklistItems: {
        key: string;
        status: ChecklistStatus;
    }[] = [
            { key: "onlyfans", status: checklist.onlyfansStatus },
            { key: "fansly", status: checklist.fanslyStatus },
            { key: "instagram", status: checklist.instagramStatus },
            { key: "twitter", status: checklist.twitterStatus },
            { key: "reddit", status: checklist.redditStatus },
            { key: "tiktok", status: checklist.tiktokStatus },
            { key: "youtube", status: checklist.youtubeStatus },
            { key: "facebook", status: checklist.facebookStatus },
            { key: "googleDrive", status: checklist.googleDriveStatus },
            { key: "websiteLogin", status: checklist.websiteLoginStatus },
            { key: "contract", status: checklist.contractStatus },
            { key: "modelRelease", status: checklist.modelReleaseStatus },
            { key: "identityDocument", status: checklist.identityDocumentStatus },
            { key: "cpf", status: checklist.cpfStatus },
            { key: "pix", status: checklist.pixStatus },
            { key: "bankAccount", status: checklist.bankAccountStatus },
            {
                key: "onlyfansVerification",
                status: checklist.onlyfansVerificationStatus,
            },
            {
                key: "fanslyVerification",
                status: checklist.fanslyVerificationStatus,
            },
            { key: "welcomeCall", status: checklist.welcomeCallStatus },
            { key: "contentReceived", status: checklist.contentReceivedStatus },
        ];

    const completedItems =
        checklistItems.filter(
            (item) =>
                item.status === "completed",
        ).length;

    return (
        <section>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <SectionHeading
                    eyebrow={t("sections.accountsAndDocs")}
                    title={t("sections.checklist")}
                />

                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white/55">
                            Progresso do onboarding
                        </span>

                        <span className="text-xl font-bold text-pink-300">
                            {checklist.onboardingPercentage}%
                        </span>
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                            className={`h-full rounded-full ${checklist.onboardingPercentage === 100
                                ? "bg-emerald-500"
                                : checklist.onboardingPercentage > 0
                                    ? "bg-yellow-400"
                                    : "bg-red-500"
                                }`}
                            style={{
                                width: `${Math.min(
                                    Math.max(
                                        checklist.onboardingPercentage,
                                        0,
                                    ),
                                    100,
                                )}%`,
                            }}
                        />
                    </div>

                    <p className="mt-3 text-xs text-white/45">
                        {completedItems} de{" "}
                        {checklistItems.length} processos concluídos
                    </p>
                </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {checklistItems.map((item) => (
                    <ChecklistCard
                        key={item.key}
                        title={tItems(`${item.key}.title`)}
                        description={tItems(`${item.key}.description`)}
                        status={item.status}
                    />
                ))}
            </div>
        </section>
    );
}

function ChecklistCard({
    title,
    description,
    status,
}: {
    title: string;
    description: string;
    status: ChecklistStatus;
}) {
    const tChecklist = useTranslations("enums.checklistStatus");

    const config = checklistStatusConfig(status);

    return (
        <article
            className={`min-h-[155px] rounded-2xl border p-5 transition hover:-translate-y-0.5 ${config.cardClass}`}
        >
            <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-bold">
                    {title}
                </h3>

                <span
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${config.dotClass}`}
                />
            </div>

            <p className="mt-3 text-xs leading-5 opacity-75">
                {description}
            </p>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.12em]">
                {tChecklist(status)}
            </p>
        </article>
    );
}

function TemporarySection({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <section className="rounded-2xl border border-dashed border-pink-400/30 bg-pink-500/5 p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
                Etapa 3
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

function SectionHeading({
    eyebrow,
    title,
}: {
    eyebrow: string;
    title: string;
}) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-300">
                {eyebrow}
            </p>

            <h2 className="mt-2 text-xl font-bold">
                {title}
            </h2>
        </div>
    );
}

function InfoItem({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                {label}
            </p>

            <p className="mt-2 break-words text-sm font-medium text-white/90">
                {value}
            </p>
        </div>
    );
}

function SimpleStatusRow({
    label,
    value,
}: {
    label: string;
    value: string | null;
}) {
    const t = useTranslations("admin.modelPage");
    const tChecklist = useTranslations("enums.checklistStatus");

    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm font-semibold">
                {label}
            </span>

            <span
                className={`text-xs font-bold ${value
                    ? "text-emerald-300"
                    : "text-red-300"
                    }`}
            >
                {value ? t("registered") : tChecklist("not_started")}
            </span>
        </div>
    );
}

function DriveLink({
    label,
    url,
}: {
    label: string;
    url: string | null;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm font-semibold">
                {label}
            </span>

            {url ? (
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
                >
                    Abrir pasta
                </a>
            ) : (
                <span className="text-xs font-bold text-red-300">
                    Não configurada
                </span>
            )}
        </div>
    );
}

function checklistStatusConfig(
    status: ChecklistStatus,
) {
    // Colour only. The words come from `enums.checklistStatus`, keyed by the
    // same database value this function is switching on.
    const configs: Record<
        ChecklistStatus,
        {
            cardClass: string;
            dotClass: string;
        }
    > = {
        completed: {
            cardClass:
                "border-emerald-400/60 bg-emerald-500/20 text-emerald-100",
            dotClass: "bg-emerald-400",
        },

        planned: {
            cardClass:
                "border-yellow-400/60 bg-yellow-500/15 text-yellow-100",
            dotClass: "bg-yellow-400",
        },

        in_progress: {
            cardClass:
                "border-yellow-400/60 bg-yellow-500/15 text-yellow-100",
            dotClass: "bg-yellow-400",
        },

        not_started: {
            cardClass:
                "border-red-400/55 bg-red-500/15 text-red-100",
            dotClass: "bg-red-400",
        },

        missing: {
            cardClass:
                "border-red-400/55 bg-red-500/15 text-red-100",
            dotClass: "bg-red-400",
        },

        blocked: {
            cardClass:
                "border-red-500/70 bg-red-600/20 text-red-100",
            dotClass: "bg-red-500",
        },

        duplicate: {
            cardClass:
                "border-blue-400/60 bg-blue-500/15 text-blue-100",
            dotClass: "bg-blue-400",
        },

        inactive: {
            cardClass:
                "border-white/15 bg-white/5 text-white/45",
            dotClass: "bg-white/35",
        },
    };

    return configs[status];
}

function showValue(
    value: string | number | null | undefined,
    fallback: string,
) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    return value;
}

/** A birthday: a calendar date, reordered by locale, never shifted by a zone. */
function formatDate(
    value: string | null,
    locale: Locale,
    fallback: string,
) {
    if (!value) {
        return fallback;
    }

    return formatCalendarDate(value.slice(0, 10), locale);
}

/** A login or audit instant: São Paulo time, in the reader's field order. */
function formatTimestamp(
    value: string | null,
    locale: Locale,
    fallback: string,
) {
    if (!value) {
        return fallback;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return formatDateTime(date, locale);
}