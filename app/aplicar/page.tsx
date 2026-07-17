"use client";

import { useState } from "react";
export default function ApplyPage() {
    const [hasOnlyFans, setHasOnlyFans] = useState("");
    const [understandsNewAccount, setUnderstandsNewAccount] = useState(false);
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
                    <form
                        action="https://formspree.io/f/mwvglebn"
                        method="POST"
                        className="rounded-[2rem] border border-[#ead8df] bg-white p-6 shadow-sm md:p-10"
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    Nome completo
                                </span>
                                <input
                                    type="text"
                                    name="nome_completo"
                                    required
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    <label className="block">
                                        <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                            Nome artístico desejado
                                        </span>

                                        <p className="mt-2 text-sm leading-6 text-[#75656c]">
                                            Caso já tenha uma ideia do nome que deseja usar profissionalmente.
                                        </p>

                                        <input
                                            type="text"
                                            name="nome_artistico_desejado"
                                            placeholder="Opcional"
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>                                </span>
                                <input
                                    type="text"
                                    name="nome_artistico"
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    Idade
                                </span>
                                <input
                                    type="number"
                                    name="idade"
                                    min="18"
                                    required
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    <label className="block">
                                        <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                            Cidade
                                        </span>

                                        <input
                                            type="text"
                                            name="cidade"
                                            required
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                            Estado
                                        </span>

                                        <input
                                            type="text"
                                            name="estado"
                                            required
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                            País
                                        </span>

                                        <select
                                            name="pais"
                                            required
                                            defaultValue=""
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
                                </span>
                                <input
                                    type="text"
                                    name="cidade_pais"
                                    required
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    WhatsApp
                                </span>
                                <input
                                    type="tel"
                                    name="whatsapp"
                                    required
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    E-mail
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block md:col-span-2">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    Instagram
                                </span>
                                <input
                                    type="text"
                                    name="instagram"
                                    placeholder="@seuusuario"
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block md:col-span-2">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    X / Twitter
                                </span>

                                <input
                                    type="text"
                                    name="twitter"
                                    placeholder="@seuusuario — opcional"
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>


                            <label className="block md:col-span-2">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    Quem indicou você para a KARAY Models?
                                </span>

                                <select
                                    name="representante_indicacao"
                                    required
                                    defaultValue=""
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


                            <div className="md:col-span-2 rounded-[1.5rem] border border-[#ead8df] bg-[#fffaf7] p-6 md:p-8">
                                <div className="mb-6">
                                    <span className="block text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                        Fotos para análise
                                    </span>

                                    <a
                                        href="/como-compartilhar-google-photos"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#d8a6b4] bg-[#f4e5e8] px-4 py-3 text-center text-sm font-semibold leading-5 text-[#9d4861] transition hover:bg-[#ead4db] hover:text-[#7f354c] sm:w-auto"
                                    >
                                        Não sabe criar o link? Veja as instruções
                                    </a>
                                </div>

                                <p className="mt-3 leading-7 text-[#75656c]">
                                    Crie quatro álbuns compartilhados ou quatro links no Google Photos, com as
                                    imagens salvas em qualidade original.
                                </p>

                                <p className="mt-2 text-sm leading-6 text-[#75656c]">
                                    Não é necessário enviar conteúdo sensual. As imagens devem ser recentes,
                                    nítidas e sem filtros que alterem significativamente sua aparência.
                                </p>

                                <div className="mt-7 grid gap-5 md:grid-cols-2">
                                    <label className="block">
                                        <span className="text-sm font-semibold text-[#8f425a]">
                                            Foto vertical 1
                                        </span>

                                        <input
                                            type="url"
                                            name="foto_vertical_1"
                                            required
                                            placeholder="https://photos.app.goo.gl/..."
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-white px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-semibold text-[#8f425a]">
                                            Foto vertical 2
                                        </span>

                                        <input
                                            type="url"
                                            name="foto_vertical_2"
                                            required
                                            placeholder="https://photos.app.goo.gl/..."
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-white px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-semibold text-[#8f425a]">
                                            Foto horizontal 1
                                        </span>

                                        <input
                                            type="url"
                                            name="foto_horizontal_1"
                                            required
                                            placeholder="https://photos.app.goo.gl/..."
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-white px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-semibold text-[#8f425a]">
                                            Foto horizontal 2
                                        </span>

                                        <input
                                            type="url"
                                            name="foto_horizontal_2"
                                            required
                                            placeholder="https://photos.app.goo.gl/..."
                                            className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-white px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                        />
                                    </label>
                                </div>

                                <p className="mt-5 text-sm font-semibold leading-6 text-[#8f425a]">
                                    Verifique se cada link pode ser visualizado por qualquer pessoa que possua o
                                    link.
                                </p>
                            </div>

                            <label className="block md:col-span-2">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    Já possui uma conta no OnlyFans?
                                </span>

                                <select
                                    name="possui_onlyfans"
                                    required
                                    value={hasOnlyFans}
                                    onChange={(event) => {
                                        setHasOnlyFans(event.target.value);
                                        setUnderstandsNewAccount(false);
                                    }}
                                    className="mt-3 w-full rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                >
                                    <option value="">Selecione</option>
                                    <option value="sim">Sim</option>
                                    <option value="nao">Não</option>
                                </select>
                            </label>

                            {hasOnlyFans === "sim" && (
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
                                            name="entende_nova_conta"
                                            required
                                            checked={understandsNewAccount}
                                            onChange={(event) => setUnderstandsNewAccount(event.target.checked)}
                                            className="mt-1 h-5 w-5 accent-[#c65f7c]"
                                        />

                                        <span className="leading-7 text-[#5f5056]">
                                            Entendo que a KARAY Models precisará criar e administrar uma nova conta
                                            principal do OnlyFans, mesmo que eu já possua uma conta.
                                        </span>
                                    </label>

                                    {understandsNewAccount && (
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
                                                name="administrar_conta_existente"
                                                required
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
                                    name="bloquear_brasil"
                                    required
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
                                    name="mostrar_rosto"
                                    required
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
                                    name="moeda_preferida"
                                    required
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
                                    name="frequencia_conteudo"
                                    required
                                    rows={4}
                                    className="mt-3 w-full resize-none rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>

                            <label className="block md:col-span-2">
                                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8f425a]">
                                    Por que deseja entrar para nossa agência?
                                </span>
                                <textarea
                                    name="motivo_candidatura"
                                    required
                                    rows={5}
                                    className="mt-3 w-full resize-none rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]"
                                />
                            </label>
                        </div>

                        <label className="mt-7 flex items-start gap-3">
                            <input
                                type="checkbox"
                                name="confirmacao_idade"
                                required
                                className="mt-1 h-5 w-5 accent-[#c65f7c]"
                            />

                            <span className="text-sm leading-6 text-[#6f6066]">
                                Confirmo que tenho pelo menos 18 anos e autorizo a KARAY Models
                                a entrar em contato comigo sobre esta candidatura.
                            </span>
                        </label>

                        <button
                            type="submit"
                            className="mt-9 w-full rounded-full bg-[#c65f7c] px-8 py-5 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b]"
                        >
                            Enviar Candidatura
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}