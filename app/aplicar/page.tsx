"use client";

import { useEffect, useState } from "react";

import { WHATSAPP_URL } from "@/lib/constants/whatsapp";
import SpanishDatePicker from "@/components/ui/SpanishDatePicker";

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
    representanteIndicacao: string;
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
    representanteIndicacao: "",
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
    const [form, setForm] = useState<FormState>(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

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
                "Confirme que entende sobre a nova conta principal do OnlyFans.",
            );
            return;
        }

        if (!form.confirmacaoIdade) {
            setErrorMessage(
                "Confirme que tem pelo menos 18 anos para continuar.",
            );
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/aplicar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ||
                        "Não foi possível enviar sua candidatura.",
                );
            }

            setIsSubmitted(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Ocorreu um erro inesperado.",
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
                        Candidatura KARAY Models
                    </p>

                    <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">
                        Candidate-se para fazer parte da nossa agência.
                    </h1>

                    <p className="mt-7 max-w-3xl text-lg leading-8 text-white/75">
                        Preencha as informações abaixo com atenção. Nossa equipe analisará
                        sua candidatura e entrará em contato caso seu perfil seja
                        selecionado.
                    </p>
                </div>
            </section>

            <section className="px-6 py-16 lg:px-12 lg:py-24">
                <div className="mx-auto max-w-[900px]">
                    {isSubmitted ? (
                        <div className="rounded-[2rem] border border-[#ead8df] bg-white p-10 text-center shadow-sm">
                            <p className="font-serif text-3xl text-[#8f425a]">
                                Candidatura enviada com sucesso!
                            </p>

                            <p className="mt-4 text-lg leading-7 text-[#5f5056]">
                                Você será redirecionada para o nosso WhatsApp em
                                instantes.
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
                                        Nome completo
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
                                        Nome artístico desejado
                                    </span>

                                    <p className="mt-2 text-sm leading-6 text-[#75656c]">
                                        Caso já tenha uma ideia do nome que deseja usar profissionalmente.
                                    </p>

                                    <input
                                        type="text"
                                        placeholder="Opcional"
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
                                        Data de nascimento
                                    </span>
                                    <div className="mt-3">
                                        <SpanishDatePicker
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
                                        Cidade
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
                                        Estado
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
                                        País
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
                                            Selecione o país
                                        </option>

                                        <option value="Brasil">Brasil</option>
                                        <option value="Colômbia">Colômbia</option>
                                        <option value="República Dominicana">República Dominicana</option>
                                        <option value="Estados Unidos">Estados Unidos</option>
                                        <option value="Venezuela">Venezuela</option>
                                        <option value="Tailândia">Tailândia</option>
                                        <option value="México">México</option>
                                        <option value="Outro">Outro</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        WhatsApp
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
                                        E-mail
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
                                        Instagram
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="@seuusuario"
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
                                        X / Twitter
                                    </span>

                                    <input
                                        type="text"
                                        placeholder="@seuusuario — opcional"
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
                                        Quem indicou você para a KARAY Models?
                                    </span>

                                    <select
                                        required
                                        value={form.representanteIndicacao}
                                        onChange={(event) =>
                                            updateField(
                                                "representanteIndicacao",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                    >
                                        <option value="" disabled>
                                            Selecione uma opção
                                        </option>

                                        <option value="Kartel">Kartel</option>
                                        <option value="Rayssa">Rayssa</option>
                                        <option value="Antonio (Tony)">Antonio (Tony)</option>
                                        <option value="Boca a boca">Fiquei sabendo por indicação / boca a boca</option>
                                    </select>
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        Já possui uma conta no OnlyFans?
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
                                        <option value="">Selecione</option>
                                        <option value="sim">Sim</option>
                                        <option value="nao">Não</option>
                                    </select>
                                </label>

                                {form.possuiOnlyfans === "sim" && (
                                    <div className="md:col-span-2 rounded-[1.5rem] border border-[#d8a6b4] bg-[#f8e9ed] p-6 md:p-8">
                                        <p className="font-serif text-2xl text-[#8f425a]">
                                            Informações importantes para quem já possui OnlyFans
                                        </p>

                                        <p className="mt-4 leading-7 text-[#66565d]">
                                            Mesmo que você já possua uma conta, nossa agência precisará criar uma nova
                                            conta principal, configurada e administrada dentro da nossa infraestrutura.
                                            Essa será a conta que receberá nosso investimento principal em marketing,
                                            posicionamento e crescimento.
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
                                                Entendo que a KARAY Models precisará criar e administrar uma nova conta
                                                principal do OnlyFans, mesmo que eu já possua uma conta.
                                            </span>
                                        </label>

                                        {form.entendeNovaConta && (
                                            <label className="mt-7 block">
                                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                                    Deseja que também administremos sua conta existente?
                                                </span>

                                                <p className="mt-3 leading-7 text-[#66565d]">
                                                    Podemos publicar nela o mesmo conteúdo utilizado na conta principal e
                                                    administrar suas mensagens e operação diária. Esse serviço custa um
                                                    adicional de 5% sobre o percentual padrão da agência. O marketing
                                                    permanecerá concentrado na nova conta principal criada pela KARAY.
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
                                                    <option value="">Selecione</option>
                                                    <option value="sim_aceito_5_porcento">
                                                        Sim, quero o gerenciamento adicional de 5%
                                                    </option>
                                                    <option value="nao">Não</option>
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                )}

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        Deseja bloquear o Brasil?
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
                                        <option value="">Selecione</option>
                                        <option value="sim">Sim</option>
                                        <option value="nao">Não</option>
                                        <option value="nao_sei">Ainda não sei</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        Está confortável em mostrar o rosto?
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
                                        <option value="">Selecione</option>
                                        <option value="sim">Sim</option>
                                        <option value="nao">Não</option>
                                        <option value="depende">Depende do conteúdo</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        Moeda preferida
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
                                        <option value="">Selecione</option>
                                        <option value="real">Real</option>
                                        <option value="dolar">Dólar</option>
                                    </select>
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        Com que frequência pode produzir conteúdo?
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
                                        Por que deseja entrar para nossa agência?
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
                                    Após o envio deste formulário, você deverá enviar 4 fotos de
                                    corpo inteiro (não nuas) pelo WhatsApp para concluir o
                                    processo de aprovação.
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
                                    Confirmo que tenho pelo menos 18 anos e autorizo a KARAY Models
                                    a entrar em contato comigo sobre esta candidatura.
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
                                {isSubmitting ? "Enviando..." : "Enviar Candidatura"}
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
}
