"use client";

import { useTranslations } from "next-intl";

/**
 * `value` is persisted by /api/aplicar and must never change; `key` names the
 * label under `site.apply.countries`.
 */
const COUNTRY_OPTIONS = [
    { value: "Brasil", key: "brazil" },
    { value: "Colômbia", key: "colombia" },
    { value: "República Dominicana", key: "dominicanRepublic" },
    { value: "Estados Unidos", key: "unitedStates" },
    { value: "Venezuela", key: "venezuela" },
    { value: "Tailândia", key: "thailand" },
    { value: "México", key: "mexico" },
    { value: "Outro", key: "other" },
] as const;

import { useEffect, useState } from "react";

import { WHATSAPP_URL } from "@/lib/constants/whatsapp";
import BirthdayDatePicker from "@/components/ui/BirthdayDatePicker";

type PublicRepresentative = {
    id: string;
    fullName: string;
    role: string;
};

type FormState = {
    nomeCompleto: string;
    nomeArtisticoDesejado: string;
    dataNascimento: string;
    cidade: string;
    estado: string;
    pais: string;
    whatsapp: string;
    email: string;
    instagram: string;
    twitter: string;
    representativeId: string;
    otherRepresentative: string;
    possuiOnlyfans: string;
    entendeNovaConta: boolean;
    administrarContaExistente: string;
    bloquearBrasil: string;
    mostrarRosto: string;
    moedaPreferida: string;
    frequenciaConteudo: string;
    motivoCandidatura: string;
    confirmacaoIdade: boolean;
};

const initialFormState: FormState = {
    nomeCompleto: "",
    nomeArtisticoDesejado: "",
    dataNascimento: "",
    cidade: "",
    estado: "",
    pais: "",
    whatsapp: "",
    email: "",
    instagram: "",
    twitter: "",
    representativeId: "",
    otherRepresentative: "",
    possuiOnlyfans: "",
    entendeNovaConta: false,
    administrarContaExistente: "",
    bloquearBrasil: "",
    mostrarRosto: "",
    moedaPreferida: "",
    frequenciaConteudo: "",
    motivoCandidatura: "",
    confirmacaoIdade: false,
};

export default function ApplyPage() {
    const t = useTranslations("site.apply");
    const tCommon = useTranslations("common.actions");
    const tState = useTranslations("common.states");
    const tRole = useTranslations("enums.role");
    const tErrors = useTranslations("errors");

    const [form, setForm] = useState<FormState>(initialFormState);
    const [representatives, setRepresentatives] = useState<PublicRepresentative[]>([]);
    const [isLoadingRepresentatives, setIsLoadingRepresentatives] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        async function loadRepresentatives() {
            try {
                const response = await fetch("/api/representatives/public");
                const result = (await response.json()) as {
                    representatives?: PublicRepresentative[];
                    error?: string;
                };

                if (response.ok && Array.isArray(result.representatives)) {
                    setRepresentatives(result.representatives);
                }
            } catch (error) {
                console.error("Failed to load representatives:", error);
            } finally {
                setIsLoadingRepresentatives(false);
            }
        }

        void loadRepresentatives();
    }, []);

    function updateField<FieldName extends keyof FormState>(
        field: FieldName,
        value: FormState[FieldName],
    ) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    useEffect(() => {
        if (!isSubmitted) {
            return;
        }

        const redirectTimer = window.setTimeout(() => {
            window.location.href = WHATSAPP_URL;
        }, 3000);

        return () => window.clearTimeout(redirectTimer);
    }, [isSubmitted]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage("");

        if (form.possuiOnlyfans === "sim" && !form.entendeNovaConta) {
            setErrorMessage(
                t("validation.confirmNewAccount"),
            );
            return;
        }

        if (form.representativeId === "other" && !form.otherRepresentative.trim()) {
            setErrorMessage(
                t("validation.referrerRequired"),
            );
            return;
        }

        if (!form.confirmacaoIdade) {
            setErrorMessage(
                t("validation.ageRequired"),
            );
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/aplicar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    representativeId:
                        form.representativeId === "other"
                            ? undefined
                            : form.representativeId,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ||
                        t("submitFailed"),
                );
            }

            setIsSubmitted(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : tErrors("generic"),
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#fff9f5] text-[#39272f]">
            <section className="bg-[#412a34] px-6 pb-20 pt-56 text-white lg:px-12 lg:pt-64">
                <div className="mx-auto max-w-[1100px]">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#e9a5b8]">
                        {t("eyebrow")}
                    </p>

                    <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">
                        {t("title")}
                    </h1>

                    <p className="mt-7 max-w-3xl text-lg leading-8 text-white/75">
                        {t("intro")}
                    </p>
                </div>
            </section>

            <section className="px-6 py-16 lg:px-12 lg:py-24">
                <div className="mx-auto max-w-[900px]">
                    {isSubmitted ? (
                        <div className="rounded-[2rem] border border-[#ead8df] bg-white p-10 text-center shadow-sm">
                            <p className="font-serif text-3xl text-[#8f425a]">
                                {t("successTitle")}
                            </p>

                            <p className="mt-4 text-lg leading-7 text-[#5f5056]">
                                {t("successBody")}
                            </p>
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-[2rem] border border-[#ead8df] bg-white p-6 shadow-sm md:p-10"
                        >
                            <div className="grid gap-6 md:grid-cols-2">
                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.fullName")}
                                    </span>
                                    <input
                                        type="text"
                                        required
                                        value={form.nomeCompleto}
                                        onChange={(event) =>
                                            updateField(
                                                "nomeCompleto",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.stageName")}
                                    </span>

                                    <p className="mt-2 text-sm leading-6 text-[#75656c]">
                                        {t("fields.stageNameHint")}
                                    </p>

                                    <input
                                        type="text"
                                        placeholder={tState("optional")}
                                        value={form.nomeArtisticoDesejado}
                                        onChange={(event) =>
                                            updateField(
                                                "nomeArtisticoDesejado",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.birthday")}
                                    </span>
                                    <div className="mt-3">
                                        <BirthdayDatePicker
                                            required
                                            value={form.dataNascimento}
                                            onChange={(value) =>
                                                updateField(
                                                    "dataNascimento",
                                                    value,
                                                )
                                            }
                                        />
                                    </div>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.city")}
                                    </span>

                                    <input
                                        type="text"
                                        required
                                        value={form.cidade}
                                        onChange={(event) =>
                                            updateField(
                                                "cidade",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.state")}
                                    </span>

                                    <input
                                        type="text"
                                        required
                                        value={form.estado}
                                        onChange={(event) =>
                                            updateField(
                                                "estado",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.country")}
                                    </span>

                                    <select
                                        required
                                        value={form.pais}
                                        onChange={(event) =>
                                            updateField(
                                                "pais",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="" disabled>
                                            {t("fields.selectCountry")}
                                        </option>

                                        {/*
                                          The VALUE is what gets submitted and
                                          stored, so it stays exactly as it was
                                          — changing it would break every row
                                          already in the database. Only the
                                          label the applicant reads changes.
                                        */}
                                        {COUNTRY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {t(`countries.${option.key}`)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.whatsapp")}
                                    </span>
                                    <input
                                        type="tel"
                                        required
                                        value={form.whatsapp}
                                        onChange={(event) =>
                                            updateField(
                                                "whatsapp",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.email")}
                                    </span>
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(event) =>
                                            updateField(
                                                "email",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.instagram")}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder={t("fields.handlePlaceholder")}
                                        value={form.instagram}
                                        onChange={(event) =>
                                            updateField(
                                                "instagram",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.twitter")}
                                    </span>

                                    <input
                                        type="text"
                                        placeholder={t("fields.handleOptionalPlaceholder")}
                                        value={form.twitter}
                                        onChange={(event) =>
                                            updateField(
                                                "twitter",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.referrer")}
                                    </span>

                                    <select
                                        required
                                        value={form.representativeId}
                                        onChange={(event) =>
                                            updateField(
                                                "representativeId",
                                                event.target.value,
                                            )
                                        }
                                        disabled={isLoadingRepresentatives}
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="" disabled>
                                            {isLoadingRepresentatives
                                                ? tState("loading")
                                                : t("selectOption")}
                                        </option>

                                        {representatives.map((rep) => (
                                            <option key={rep.id} value={rep.id}>
                                                {rep.fullName}
                                                {rep.role === "owner" ||
                                                rep.role === "administrator" ||
                                                rep.role === "representative"
                                                    ? ` (${tRole(rep.role)})`
                                                    : ""}
                                            </option>
                                        ))}

                                        <option value="other">{t("options.other")}</option>
                                    </select>

                                    {form.representativeId === "other" && (
                                        <input
                                            type="text"
                                            required
                                            value={form.otherRepresentative}
                                            onChange={(event) =>
                                                updateField(
                                                    "otherRepresentative",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={t("fields.referrerPlaceholder")}
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    )}
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.hasOnlyFans")}
                                    </span>

                                    <select
                                        required
                                        value={form.possuiOnlyfans}
                                        onChange={(event) => {
                                            updateField(
                                                "possuiOnlyfans",
                                                event.target.value,
                                            );
                                            updateField(
                                                "entendeNovaConta",
                                                false,
                                            );
                                        }}
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="">{t("select")}</option>
                                        <option value="sim">{tState("yes")}</option>
                                        <option value="nao">{tState("no")}</option>
                                    </select>
                                </label>

                                {form.possuiOnlyfans === "sim" && (
                                    <div className="md:col-span-2 rounded-[1.5rem] border border-[#d8a6b4] bg-[#f8e9ed] p-6 md:p-8">
                                        <p className="font-serif text-2xl text-[#8f425a]">
                                            {t("existingAccount.title")}
                                        </p>

                                        <p className="mt-4 leading-7 text-[#66565d]">
                                            {t("existingAccount.body")}
                                        </p>

                                        <label className="mt-6 flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                required
                                                checked={form.entendeNovaConta}
                                                onChange={(event) =>
                                                    updateField(
                                                        "entendeNovaConta",
                                                        event.target.checked,
                                                    )
                                                }
                                                className="mt-1 h-5 w-5 accent-[#c65f7c]"
                                            />

                                            <span className="leading-7 text-[#5f5056]">
                                                {t("existingAccount.consent")}
                                            </span>
                                        </label>

                                        {form.entendeNovaConta && (
                                            <label className="mt-7 block">
                                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                                    {t("fields.manageExisting")}
                                                </span>

                                                <p className="mt-3 leading-7 text-[#66565d]">
                                                    {t("existingAccount.manageBody")}
                                                </p>

                                                <select
                                                    required
                                                    value={form.administrarContaExistente}
                                                    onChange={(event) =>
                                                        updateField(
                                                            "administrarContaExistente",
                                                            event.target.value,
                                                        )
                                                    }
                                                    className="mt-4 w-full rounded-xl border border-[#d7bdc6] bg-white px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                                >
                                                    <option value="">{t("select")}</option>
                                                    <option value="sim_aceito_5_porcento">
                                                        {t("options.yesExtraFee")}
                                                    </option>
                                                    <option value="nao">{tState("no")}</option>
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                )}

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.blockBrazil")}
                                    </span>
                                    <select
                                        required
                                        value={form.bloquearBrasil}
                                        onChange={(event) =>
                                            updateField(
                                                "bloquearBrasil",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="">{t("select")}</option>
                                        <option value="sim">{tState("yes")}</option>
                                        <option value="nao">{tState("no")}</option>
                                        <option value="nao_sei">{t("options.notSure")}</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.showFace")}
                                    </span>
                                    <select
                                        required
                                        value={form.mostrarRosto}
                                        onChange={(event) =>
                                            updateField(
                                                "mostrarRosto",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="">{t("select")}</option>
                                        <option value="sim">{tState("yes")}</option>
                                        <option value="nao">{tState("no")}</option>
                                        <option value="depende">{t("options.depends")}</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.currency")}
                                    </span>
                                    <select
                                        required
                                        value={form.moedaPreferida}
                                        onChange={(event) =>
                                            updateField(
                                                "moedaPreferida",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="">{t("select")}</option>
                                        <option value="real">{t("options.real")}</option>
                                        <option value="dolar">{t("options.dollar")}</option>
                                    </select>
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.frequency")}
                                    </span>
                                    <textarea
                                        required
                                        rows={4}
                                        value={form.frequenciaConteudo}
                                        onChange={(event) =>
                                            updateField(
                                                "frequenciaConteudo",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full resize-none rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        {t("fields.motivation")}
                                    </span>
                                    <textarea
                                        required
                                        rows={5}
                                        value={form.motivoCandidatura}
                                        onChange={(event) =>
                                            updateField(
                                                "motivoCandidatura",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full resize-none rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    />
                                </label>
                            </div>

                            <div className="mt-9 rounded-[1.5rem] border border-[#ead8df] bg-[#fffaf7] p-6 md:p-8">
                                <p className="leading-7 text-[#66565d]">
                                    {t("photosNotice")}
                                </p>
                            </div>

                            <label className="mt-7 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    required
                                    checked={form.confirmacaoIdade}
                                    onChange={(event) =>
                                        updateField(
                                            "confirmacaoIdade",
                                            event.target.checked,
                                        )
                                    }
                                    className="mt-1 h-5 w-5 accent-[#c65f7c]"
                                />

                                <span className="text-sm leading-6 text-[#6f6066]">
                                    {t("ageConfirmation")}
                                </span>
                            </label>

                            {errorMessage && (
                                <div className="mt-6 rounded-xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="mt-9 w-full rounded-full bg-[#c65f7c] px-8 py-5 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                            >
                                {isSubmitting ? tCommon("sending") : t("submit")}
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
}
