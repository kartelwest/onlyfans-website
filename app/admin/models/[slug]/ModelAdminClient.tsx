"use client";

import NotesTab from "@/components/admin/model/NotesTab";
import DocumentsTab from "@/components/admin/model/DocumentsTab";
import OnlyFansTab from "@/components/admin/model/OnlyFansTab";
import PlatformsTab from "@/components/admin/model/PlatformsTab";
import OverviewTab from "@/components/admin/model/OverviewTab";
import ChecklistTab from "@/components/admin/model/ChecklistTab";
import PaymentsTab from "@/components/admin/model/PaymentsTab";

import { useState } from "react";
import Link from "next/link";

import type {
    ChecklistStatus,
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

const tabs: {
    id: TabId;
    label: string;
}[] = [
        { id: "summary", label: "Resumo" },
        { id: "checklist", label: "Status" },
        { id: "platforms", label: "Plataformas" },
        { id: "onlyfans", label: "OnlyFans" },
        { id: "fansly", label: "Fansly" },
        { id: "drive", label: "Google Drive" },
        { id: "documents", label: "Documentos" },
        { id: "payments", label: "Pagamentos" },
        { id: "notes", label: "Notas" },
        { id: "history", label: "Histórico" },
    ];

export default function ModelAdminClient({
    model: initialModel,
    checklist,
    currentUserRole,
}: ModelAdminClientProps) {
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
                            <div className="flex items-center gap-5">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-black/30 text-3xl font-bold">
                                    {model.profilePhotoUrl ? (
                                        <img
                                            src={model.profilePhotoUrl}
                                            alt={model.displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        model.displayName
                                            .charAt(0)
                                            .toUpperCase()
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
                                    status={
                                        model.active
                                            ? "completed"
                                            : "inactive"
                                    }
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
                                onModelUpdate={setModel}
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
                                description="Informações completas da conta Fansly administrada pela agência."
                            />
                        )}

                        {activeTab === "drive" && (
                            <TemporarySection
                                title="Google Drive"
                                description="Pastas, links, acesso e envio de conteúdo."
                            />
                        )}

                        {activeTab === "documents" && (
                            <DocumentsTab
                                model={model}
                                currentUserRole={currentUserRole}
                            />
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
                            <NotesTab
                                modelId={model.id}
                                currentUserRole={currentUserRole}
                                historyOnly
                            />
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
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-white/10 bg-black/20 p-6 lg:col-span-2">
                <SectionHeading
                    eyebrow="Informações"
                    title="Dados principais"
                />

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <InfoItem
                        label="Nome completo"
                        value={model.fullName}
                    />

                    <InfoItem
                        label="Nome artístico"
                        value={showValue(model.stageName)}
                    />

                    <InfoItem
                        label="Data de nascimento"
                        value={formatDate(model.birthday)}
                    />

                    <InfoItem
                        label="Nacionalidade"
                        value={showValue(model.nationality)}
                    />

                    <InfoItem
                        label="Cidade"
                        value={showValue(model.city)}
                    />

                    <InfoItem
                        label="Idioma"
                        value={showValue(model.language)}
                    />

                    <InfoItem
                        label="E-mail"
                        value={showValue(model.email)}
                    />

                    <InfoItem
                        label="WhatsApp"
                        value={showValue(model.whatsapp)}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <SectionHeading
                    eyebrow="Progresso"
                    title="Onboarding"
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
                            ? "Onboarding concluído"
                            : "Onboarding ainda não concluído"}
                    </p>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <SectionHeading
                    eyebrow="Contas"
                    title="Plataformas"
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
                    eyebrow="Arquivos"
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
                    eyebrow="Atividade"
                    title="Registro da conta"
                />

                <div className="mt-5 space-y-5">
                    <InfoItem
                        label="Último login"
                        value={formatDateTime(
                            model.lastLoginAt,
                        )}
                    />

                    <InfoItem
                        label="Criada em"
                        value={formatDateTime(
                            model.createdAt,
                        )}
                    />

                    <InfoItem
                        label="Última atualização"
                        value={formatDateTime(
                            model.updatedAt,
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
    const checklistItems: {
        title: string;
        description: string;
        status: ChecklistStatus;
    }[] = [
            {
                title: "OnlyFans",
                description:
                    "Conta e operação da modelo no OnlyFans.",
                status: checklist.onlyfansStatus,
            },
            {
                title: "Fansly",
                description:
                    "Conta e operação da modelo no Fansly.",
                status: checklist.fanslyStatus,
            },
            {
                title: "Instagram",
                description:
                    "Conta de divulgação e desenvolvimento da marca.",
                status: checklist.instagramStatus,
            },
            {
                title: "X / Twitter",
                description:
                    "Conta para divulgação e aquisição de assinantes.",
                status: checklist.twitterStatus,
            },
            {
                title: "Reddit",
                description:
                    "Conta e comunidades de divulgação.",
                status: checklist.redditStatus,
            },
            {
                title: "TikTok",
                description:
                    "Conta de conteúdo e crescimento orgânico.",
                status: checklist.tiktokStatus,
            },
            {
                title: "YouTube",
                description:
                    "Canal para vídeos, Shorts e marca.",
                status: checklist.youtubeStatus,
            },
            {
                title: "Facebook",
                description:
                    "Conta ou página utilizada pela operação.",
                status: checklist.facebookStatus,
            },
            {
                title: "Google Drive",
                description:
                    "Pastas de conteúdo e documentos.",
                status: checklist.googleDriveStatus,
            },
            {
                title: "Login do site",
                description:
                    "Acesso individual à Área da Modelo.",
                status: checklist.websiteLoginStatus,
            },
            {
                title: "Contrato",
                description:
                    "Contrato da agência assinado.",
                status: checklist.contractStatus,
            },
            {
                title: "Model Release",
                description:
                    "Autorização de uso de imagem assinada.",
                status: checklist.modelReleaseStatus,
            },
            {
                title: "Documento de identidade",
                description:
                    "Passaporte, RG ou documento válido.",
                status:
                    checklist.identityDocumentStatus,
            },
            {
                title: "CPF",
                description:
                    "CPF informado e verificado.",
                status: checklist.cpfStatus,
            },
            {
                title: "PIX",
                description:
                    "Chave PIX cadastrada.",
                status: checklist.pixStatus,
            },
            {
                title: "Conta bancária",
                description:
                    "Conta bancária vinculada.",
                status: checklist.bankAccountStatus,
            },
            {
                title: "Verificação OnlyFans",
                description:
                    "Conta aprovada pelo OnlyFans.",
                status:
                    checklist.onlyfansVerificationStatus,
            },
            {
                title: "Verificação Fansly",
                description:
                    "Conta aprovada pelo Fansly.",
                status:
                    checklist.fanslyVerificationStatus,
            },
            {
                title: "Chamada de boas-vindas",
                description:
                    "Reunião inicial concluída.",
                status: checklist.welcomeCallStatus,
            },
            {
                title: "Conteúdo inicial",
                description:
                    "Fotos e vídeos iniciais recebidos.",
                status: checklist.contentReceivedStatus,
            },
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
                    eyebrow="Contas e documentos"
                    title="Checklist da modelo"
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
                        key={item.title}
                        title={item.title}
                        description={item.description}
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
                {config.label}
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
                Step 3
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
                {value ? "Cadastrado" : "Não iniciado"}
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
    const configs: Record<
        ChecklistStatus,
        {
            label: string;
            cardClass: string;
            dotClass: string;
        }
    > = {
        completed: {
            label: "Concluído",
            cardClass:
                "border-emerald-400/60 bg-emerald-500/20 text-emerald-100",
            dotClass: "bg-emerald-400",
        },

        planned: {
            label: "Planejado",
            cardClass:
                "border-yellow-400/60 bg-yellow-500/15 text-yellow-100",
            dotClass: "bg-yellow-400",
        },

        in_progress: {
            label: "Em andamento",
            cardClass:
                "border-yellow-400/60 bg-yellow-500/15 text-yellow-100",
            dotClass: "bg-yellow-400",
        },

        not_started: {
            label: "Não iniciado",
            cardClass:
                "border-red-400/55 bg-red-500/15 text-red-100",
            dotClass: "bg-red-400",
        },

        missing: {
            label: "Pendente",
            cardClass:
                "border-red-400/55 bg-red-500/15 text-red-100",
            dotClass: "bg-red-400",
        },

        blocked: {
            label: "Bloqueado",
            cardClass:
                "border-red-500/70 bg-red-600/20 text-red-100",
            dotClass: "bg-red-500",
        },

        duplicate: {
            label: "Duplicado",
            cardClass:
                "border-blue-400/60 bg-blue-500/15 text-blue-100",
            dotClass: "bg-blue-400",
        },

        inactive: {
            label: "Inativo",
            cardClass:
                "border-white/15 bg-white/5 text-white/45",
            dotClass: "bg-white/35",
        },
    };

    return configs[status];
}

function showValue(
    value: string | number | null | undefined,
) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Não informado";
    }

    return value;
}

function formatDate(value: string | null) {
    if (!value) {
        return "Não informado";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function formatDateTime(value: string | null) {
    if (!value) {
        return "Nunca";
    }

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

function roleLabel(
    role: ManagementRole,
) {
    const labels: Record<
        ManagementRole,
        string
    > = {
        owner: "Proprietário",
        administrator: "Administrador",
        representative: "Representante",
        model: "Modelo",
    };

    return labels[role];
}