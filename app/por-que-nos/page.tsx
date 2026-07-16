const supportItems = [
  "Configuração completa da conta do OnlyFans",
  "Desenvolvimento e posicionamento da sua marca",
  "Estratégia e planejamento de conteúdo",
  "Gerenciamento diário da conta",
  "Estratégias de mensagens com fãs e vendas",
  "Gerenciamento profissional de chats",
  "Marketing em diversas plataformas de redes sociais",
  "Análise de desempenho e métricas",
  "Suporte técnico",
  "Planejamento de crescimento a longo prazo",
];

const agencyManagementItems = [
  "Gerenciamento completo da conta",
  "Estratégias de negócios",
  "Planejamento de conteúdo",
  "Estratégias de crescimento de assinantes",
  "Orientação diária",
  "Suporte técnico",
  "Relatórios e análises",
  "Otimização do perfil",
  "Estratégias de precificação",
  "Estratégias de PPV",
  "Desenvolvimento do negócio a longo prazo",
];

const marketingItems = [
  "Divulgação das suas redes sociais",
  "Direcionamento de tráfego qualificado para sua página",
  "Crescimento da sua base de assinantes",
  "Gerenciamento de campanhas promocionais",
  "Testes de novas estratégias de marketing",
  "Aumento da sua visibilidade em diversas plataformas",
];

const accountItems = [
  "OnlyFans",
  "X (Twitter)",
  "Instagram",
  "Reddit",
  "TikTok",
  "E-mail profissional",
  "Página de links",
  "Outras plataformas promocionais utilizadas pela agência",
];

const existingAccountItems = [
  "Administrar profissionalmente a conta",
  "Publicar o mesmo conteúdo postado na conta principal",
  "Manter consistência entre as duas contas",
  "Gerenciar as mensagens e a operação diária",
];

const chatItems = [
  "Respostas rápidas aos assinantes",
  "Construção de relacionamentos com os fãs",
  "Aumento das vendas de PPV",
  "Incentivo ao envio de gorjetas",
  "Melhoria da retenção de assinantes",
  "Conversas envolventes, sempre respeitando seus limites e preferências",
];

const platformItems = [
  "X (Twitter)",
  "Instagram",
  "Reddit",
  "TikTok, quando apropriado",
  "YouTube, quando apropriado",
  "Páginas de links e ferramentas promocionais",
];

const infrastructureItems = [
  "Celular dedicado",
  "Proxy residencial estático",
  "Perfil exclusivo de navegador",
  "Contas dedicadas de redes sociais",
  "Procedimentos seguros de gerenciamento",
];

const growthItems = [
  "Preço da assinatura",
  "Desempenho dos PPVs",
  "Estratégia de conteúdo",
  "Conversão de assinantes",
  "Retenção de assinantes",
  "Engajamento dos fãs",
  "Desempenho das campanhas de marketing",
  "Ganhos mensais",
];

const freedomItems = [
  "Não existe obrigação contratual de longo prazo que impeça sua saída",
  "Removeremos todo o nosso acesso administrativo",
  "Sua conta será encerrada conforme previsto no contrato",
  "Todo o processo será conduzido com profissionalismo e respeito",
];

function KarrayHeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 30"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M16 27L5.2 16.5C1.4 12.8 1.4 6.9 5.2 3.5C8.7.3 14 .9 16 5.1C18 .9 23.3.3 26.8 3.5C30.6 6.9 30.6 12.8 26.8 16.5L16 27Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M7.2 17.8L2.8 27.2M24.8 17.8L29.2 27.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
        {eyebrow}
      </p>

      <h2 className="mt-5 font-serif text-4xl leading-[1.08] text-[#39272f] md:text-5xl">
        {title}
      </h2>

      {description && (
        <p className="mt-6 text-lg leading-8 text-[#75656c]">{description}</p>
      )}

      <div
        className={`mt-7 flex items-center gap-3 text-[#c65f7c] ${
          centered ? "justify-center" : ""
        }`}
      >
        <span className="h-px w-14 bg-[#d8a6b4]" />
        <KarrayHeartIcon />
        <span className="h-px w-14 bg-[#d8a6b4]" />
      </div>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-4 rounded-2xl border border-[#ead8df] bg-white p-5"
        >
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6e3e9] text-[#b85f79]">
            <KarrayHeartIcon className="h-4 w-4" />
          </span>

          <span className="leading-7 text-[#66565d]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function WhyUsPage() {
  return (
    <main className="overflow-hidden bg-[#fff9f5] text-[#39272f]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#412a34] px-6 pb-24 pt-44 text-white lg:px-12 lg:pb-32">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#c65f7c]/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-[#e9a5b8]/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1300px]">
          <div className="max-w-5xl">
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.34em] text-[#e9a5b8]">
              CONFIANÇA, ESTRATÉGIA E CRESCIMENTO
            </p>

            <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">
              Por Que Escolher a Nossa Agência
            </h1>

            <p className="mt-8 max-w-4xl text-lg leading-8 text-white/75 md:text-xl">
              <span className="font-semibold text-[#f4c2d0]">
                Sim, você pode bloquear o Brasil ou outro país no OnlyFans para
                proteger sua privacidade.
              </span>{" "}
              Escolher uma agência de OnlyFans é uma das decisões mais
              importantes que você tomará. Nossa missão não é apenas administrar
              sua conta — estamos aqui para construir sua marca, maximizar seus
              ganhos e estabelecer uma parceria de longo prazo baseada em
              confiança, transparência e sucesso mútuo.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <div className="border-l border-[#e9a5b8]/50 pl-6">
              <p className="font-serif text-5xl text-[#e9a5b8]">30</p>
              <p className="mt-3 text-sm uppercase tracking-[0.14em] text-white/70">
                Modelos ativas no máximo
              </p>
            </div>

            <div className="border-l border-[#e9a5b8]/50 pl-6">
              <p className="font-serif text-5xl text-[#e9a5b8]">60%</p>
              <p className="mt-3 text-sm uppercase tracking-[0.14em] text-white/70">
                Participação destinada à modelo
              </p>
            </div>

            <div className="border-l border-[#e9a5b8]/50 pl-6">
              <p className="font-serif text-5xl text-[#e9a5b8]">360°</p>
              <p className="mt-3 text-sm uppercase tracking-[0.14em] text-white/70">
                Gestão completa da marca
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INVESTIMOS EM VOCÊ */}
      <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
                Nosso compromisso
              </p>

              <h2 className="mt-5 font-serif text-4xl leading-[1.08] text-[#39272f] md:text-5xl lg:text-6xl">
                Nós Investimos em Você
              </h2>

              <p className="mt-7 text-lg leading-8 text-[#75656c]">
                Ao contrário de muitas agências, nós não apenas administramos sua
                conta. Investimos dinheiro, tecnologia, infraestrutura, experiência e
                tempo para ajudá-la a construir um negócio profissional, seguro e
                lucrativo.
              </p>

              <div className="mx-auto mt-7 flex items-center justify-center gap-3 text-[#c65f7c]">
                <span className="h-px w-16 bg-[#d8a6b4]" />

                <KarrayHeartIcon className="h-5 w-5" />

                <span className="h-px w-16 bg-[#d8a6b4]" />
              </div>
            </div>

            <div className="mt-16 grid gap-7 md:grid-cols-2">
              {/* PROXY */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M12 3a9 9 0 1 0 9 9" />
                    <path d="M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 18.5 12 21" />
                    <path d="M12 3C9.5 5.5 8.3 8.5 8.3 12s1.2 6.5 3.7 9" />
                    <path d="M3.5 9h13M3.5 15h13" />
                    <path d="M18.5 4.5v5h-5" />
                    <path d="M20.5 3.5 13.5 10.5" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  Proxy Residencial Exclusivo
                </h3>

                <p className="mt-5 leading-8 text-[#75656c]">
                  Investimos em um proxy residencial estático exclusivo para cada
                  modelo. Ele fornece uma conexão digital estável e consistente para a
                  administração da conta.
                </p>

                <p className="mt-4 leading-8 text-[#75656c]">
                  Isso reduz os riscos causados por acessos realizados de diferentes
                  países, endereços de internet e dispositivos, ajudando a proteger a
                  conta e tornando a gestão muito mais segura e organizada.
                </p>
              </article>

              {/* NAVEGADOR */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M3 8h18" />
                    <path d="M7 6h.01M10 6h.01" />
                    <path d="m9 14 2 2 4-5" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  Perfil Exclusivo de Navegador
                </h3>

                <p className="mt-5 leading-8 text-[#75656c]">
                  Cada modelo recebe um ambiente de navegador separado e exclusivo,
                  criado para manter as contas organizadas e evitar conflitos entre
                  diferentes perfis.
                </p>

                <p className="mt-4 leading-8 text-[#75656c]">
                  Essa separação reduz erros operacionais, melhora a segurança e permite
                  que nossa equipe administre cada marca dentro de uma infraestrutura
                  própria.
                </p>
              </article>

              {/* MARKETING */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M4 13V8l13-4v13L4 13Z" />
                    <path d="M7 14v5h4l-1-5" />
                    <path d="M19 8a3 3 0 0 1 0 5" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  Ferramentas Profissionais de Marketing
                </h3>

                <p className="mt-5 leading-8 text-[#75656c]">
                  Investimos em plataformas e ferramentas profissionais para
                  planejamento de conteúdo, análise de desempenho, crescimento da
                  audiência e otimização das campanhas de divulgação.
                </p>

                <p className="mt-4 leading-8 text-[#75656c]">
                  Essas ferramentas nos ajudam a identificar o que está funcionando,
                  testar novas estratégias e direcionar nossos recursos para as ações
                  que produzem os melhores resultados.
                </p>
              </article>

              {/* GESTÃO */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M4 20V10h4v10H4Z" />
                    <path d="M10 20V4h4v16h-4Z" />
                    <path d="M16 20v-7h4v7h-4Z" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  Ferramentas de Gestão e Análise
                </h3>

                <p className="mt-5 leading-8 text-[#75656c]">
                  Utilizamos sistemas para organizar conteúdo, acompanhar métricas,
                  controlar estratégias de vendas e monitorar continuamente o
                  crescimento da conta.
                </p>

                <p className="mt-4 leading-8 text-[#75656c]">
                  Sua página nunca fica no piloto automático. Os resultados são
                  analisados para que possamos adaptar preços, PPVs, conteúdo,
                  campanhas e estratégias de retenção.
                </p>
              </article>
            </div>

            <div className="mt-12 rounded-[2rem] bg-[#412a34] p-8 text-white md:p-10">
              <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#e9a5b8]">
                    Investimento completo
                  </p>

                  <h3 className="mt-5 font-serif text-3xl leading-tight md:text-4xl">
                    Nosso investimento vai muito além da tecnologia.
                  </h3>

                  <p className="mt-6 leading-8 text-white/70">
                    Também investimos diariamente na construção, posicionamento,
                    administração e expansão da sua marca.
                  </p>
                </div>

                <ul className="grid gap-4 sm:grid-cols-2">
                  {supportItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                      <span className="mt-1 shrink-0 text-[#e9a5b8]">
                        <KarrayHeartIcon className="h-5 w-5" />
                      </span>

                      <span className="leading-7 text-white/75">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 rounded-2xl bg-[#f4e5e8] p-7 text-center md:p-9">
              <p className="mx-auto max-w-4xl font-serif text-2xl leading-9 text-[#8f425a]">
                Todos esses investimentos são realizados pela agência sem custo
                adicional para a modelo durante nossa parceria.
              </p>
            </div>
          </div>
        </section>

        {/* FAMÍLIA */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Relacionamentos duradouros"
              title="Tratamos Nossas Modelos Como Família"
            />

            <div className="space-y-6 text-lg leading-8 text-[#66565d]">
              <p>
                Ao entrar para nossa agência, você se torna muito mais do que uma
                cliente — você passa a fazer parte da nossa família.
              </p>

              <p>
                Acreditamos que os negócios mais fortes são construídos com
                confiança, honestidade, lealdade, comunicação e respeito mútuo.
              </p>

              <p>
                Celebramos suas conquistas, ajudamos você a superar desafios e
                estamos comprometidos com o seu crescimento a longo prazo.
              </p>

              <p>
                Nosso objetivo é construir relacionamentos duradouros, e não apenas
                administrar contas.
              </p>

              <p className="font-semibold text-[#39272f]">
                Quando uma de nossas modelos tem sucesso, toda a nossa equipe
                também tem.
              </p>

              <p className="font-semibold text-[#b85f79]">
                Estamos ao seu lado em cada etapa da sua jornada.
              </p>
            </div>
          </div>
        </section>

        {/* 30 MODELOS */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Qualidade acima de quantidade"
              title="Limitamos Nossa Agência a Apenas 30 Modelos"
              description="Diferentemente de outras agências que continuam contratando centenas de criadoras, acreditamos que uma equipe menor produz resultados muito melhores."
              centered
            />

            <div className="mt-16 grid gap-7 lg:grid-cols-2">
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b85f79]">
                  Motivo 01
                </p>

                <h3 className="mt-5 font-serif text-3xl">
                  Queremos Que Todas as Nossas Modelos Tenham Sucesso
                </h3>

                <div className="mt-7 space-y-5 leading-8 text-[#75656c]">
                  <p>Nosso objetivo não é ser a maior agência.</p>

                  <p className="font-semibold text-[#39272f]">
                    Nosso objetivo é ser uma das melhores.
                  </p>

                  <p>
                    Ao limitar o número de modelos que representamos, conseguimos
                    dedicar tempo, estratégia e recursos suficientes para ajudar
                    cada modelo a atingir seu máximo potencial financeiro.
                  </p>

                  <p>
                    Queremos ajudá-la a construir um negócio lucrativo e duradouro.
                  </p>
                </div>
              </article>

              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b85f79]">
                  Motivo 02
                </p>

                <h3 className="mt-5 font-serif text-3xl">
                  Toda Modelo Merece Atenção Personalizada
                </h3>

                <div className="mt-7 space-y-5 leading-8 text-[#75656c]">
                  <p>
                    Cada modelo recebe orientação individual, suporte de
                    marketing, gerenciamento da conta, planejamento de conteúdo e
                    comunicação constante.
                  </p>

                  <p className="font-semibold text-[#39272f]">
                    Você nunca será tratada como apenas mais uma conta ou mais um
                    número.
                  </p>

                  <p>
                    Nossa equipe reduzida permite responder rapidamente, resolver
                    problemas com eficiência e adaptar estratégias sempre que
                    necessário.
                  </p>
                </div>
              </article>
            </div>

            <div className="mt-10 rounded-[2rem] bg-[#412a34] px-8 py-10 text-center text-white md:px-14">
              <p className="mx-auto max-w-4xl font-serif text-2xl leading-9">
                Preferimos ajudar 30 modelos a alcançarem grande sucesso do que
                representar centenas que nunca recebem a atenção e o suporte
                necessários.
              </p>

              <p className="mt-5 font-semibold text-[#e9a5b8]">
                Para nós, qualidade sempre será mais importante do que quantidade.
              </p>
            </div>
          </div>
        </section>

        {/* TRANSPARÊNCIA */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Clareza em todas as etapas"
              title="Transparência Total"
              description="Você sempre saberá como seus ganhos são distribuídos, como sua conta é administrada e o que recebe em troca."
            />

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {[
                {
                  value: "60%",
                  title: "Modelo",
                  text: "Você recebe a maior parte da receita porque é o rosto da marca, cria o conteúdo e constrói o relacionamento com os assinantes.",
                },
                {
                  value: "20%",
                  title: "Gestão da Agência",
                  text: "Nossa porcentagem cobre administração diária, estratégia, suporte, otimização e crescimento do negócio.",
                },
                {
                  value: "20%",
                  title: "Empresa de Marketing",
                  text: "A equipe de marketing trabalha para aumentar audiência, visibilidade, tráfego e base de assinantes.",
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className="rounded-[2rem] bg-[#412a34] p-8 text-white"
                >
                  <p className="font-serif text-5xl text-[#e9a5b8]">
                    {item.value}
                  </p>

                  <h3 className="mt-5 font-serif text-2xl">{item.title}</h3>

                  <p className="mt-5 leading-7 text-white/70">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-16 grid gap-10 lg:grid-cols-2">
              <div>
                <h3 className="font-serif text-3xl">
                  O que nossos 20% cobrem
                </h3>

                <CheckList items={agencyManagementItems} />
              </div>

              <div>
                <h3 className="font-serif text-3xl">
                  O que os 20% de marketing cobrem
                </h3>

                <CheckList items={marketingItems} />
              </div>
            </div>
          </div>
        </section>

        {/* 3 PRIMEIROS MESES */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Investimento inicial"
              title="Nosso Compromisso nos Três Primeiros Meses"
            />

            <div className="rounded-[2rem] border border-[#e5cad3] bg-white p-8 md:p-10">
              <div className="space-y-6 text-lg leading-8 text-[#75656c]">
                <p>Construir um negócio de sucesso no OnlyFans leva tempo.</p>

                <p>
                  Por isso, durante os seus três primeiros meses conosco,
                  normalmente abrimos mão da nossa taxa de gestão de 20%.
                </p>

                <p>
                  Assim, você poderá ficar com uma parte maior dos seus ganhos
                  enquanto sua página cresce e sua base de assinantes está sendo
                  construída.
                </p>

                <p>
                  Mesmo sem receber nossa taxa de gestão nesse período,
                  continuamos oferecendo o mesmo nível de gerenciamento,
                  estratégia, orientação e suporte.
                </p>

                <p className="font-semibold text-[#b85f79]">
                  Investir no seu sucesso a longo prazo beneficia todos os
                  envolvidos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CONTAS */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Consistência e profissionalismo"
              title="Nós Cuidamos da Criação de Todas as Contas"
              description="Para garantir consistência, segurança e uma gestão profissional, nossa agência cria e configura todas as contas relacionadas ao seu negócio."
            />

            <CheckList items={accountItems} />

            <p className="mt-10 max-w-4xl text-lg leading-8 text-[#75656c]">
              Todas as contas são configuradas de acordo com nossos padrões
              internos antes do lançamento oficial da sua marca.
            </p>
          </div>
        </section>

        {/* ACESSO E SEGURANÇA */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Proteção e estabilidade"
              title="Política de Acesso às Contas"
              description="Você poderá acompanhar resultados, estatísticas, crescimento de assinantes, ganhos e desempenho. Entretanto, não fornecemos acesso administrativo completo à conta principal gerenciada pela agência."
            />

            <div className="mt-14 grid gap-7 lg:grid-cols-2">
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b85f79]">
                  Proteção 01
                </p>

                <h3 className="mt-5 font-serif text-3xl">
                  Segurança da Conta
                </h3>

                <div className="mt-7 space-y-5 leading-8 text-[#75656c]">
                  <p>
                    Nossa equipe administra as contas utilizando proxies
                    residenciais estáticos.
                  </p>

                  <p>
                    Eles fornecem uma conexão residencial estável, permitindo que
                    nossa equipe localizada nos Estados Unidos administre com
                    segurança contas de modelos que vivem em países como Brasil e
                    Colômbia.
                  </p>

                  <p>
                    Esse sistema ajuda a manter a consistência dos acessos e reduz
                    riscos causados por conexões realizadas de diferentes países.
                  </p>
                </div>
              </article>

              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 md:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b85f79]">
                  Proteção 02
                </p>

                <h3 className="mt-5 font-serif text-3xl">
                  Proteção do Nosso Investimento
                </h3>

                <div className="mt-7 space-y-5 leading-8 text-[#75656c]">
                  <p>
                    Construir uma conta de sucesso exige um grande investimento de
                    tempo, experiência, trabalho e dinheiro.
                  </p>

                  <p>
                    Se passarmos sete meses desenvolvendo uma conta até que ela
                    esteja gerando R$ 30.000 por mês, precisamos proteger todo o
                    investimento realizado.
                  </p>

                  <p>
                    Restringir o acesso administrativo protege tanto a agência
                    quanto a modelo, evitando alterações não autorizadas e
                    problemas de segurança.
                  </p>
                </div>
              </article>
            </div>

            <div className="mt-10 rounded-2xl bg-[#f4e5e8] p-8">
              <p className="text-lg leading-8 text-[#66565d]">
                Essa política não existe por falta de confiança. Ela existe para
                proteger o relacionamento comercial e garantir justiça para ambas
                as partes.
              </p>
            </div>
          </div>
        </section>

        {/* CONTAS EXISTENTES */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Gestão adicional"
              title="Contas de OnlyFans Já Existentes"
              description="Se você já possui uma conta no OnlyFans, também podemos administrá-la. Como esse serviço exige uma gestão adicional, cobramos 5% adicionais sobre nosso percentual padrão."
            />

            <p className="mt-8 max-w-4xl text-lg leading-8 text-[#75656c]">
              É importante destacar que não fazemos marketing da conta já
              existente.
            </p>

            <CheckList items={existingAccountItems} />

            <p className="mt-10 max-w-4xl text-lg leading-8 text-[#75656c]">
              Todos os investimentos em marketing permanecerão concentrados na
              conta principal desenvolvida pela agência, permitindo que os
              recursos promocionais fortaleçam uma única marca.
            </p>
          </div>
        </section>

        {/* LIBERDADE */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Parcerias conquistadas"
                title="Você Mantém a Liberdade de Escolha"
              />

              <p className="mt-8 text-lg leading-8 text-[#75656c]">
                Acreditamos que parcerias devem ser conquistadas, nunca impostas.
                Você pode deixar nossa agência a qualquer momento.
              </p>
            </div>

            <div className="rounded-[2rem] bg-[#412a34] p-8 text-white md:p-10">
              <ul className="space-y-6">
                {freedomItems.map((item) => (
                  <li key={item} className="flex items-start gap-4">
                    <span className="mt-1 text-[#e9a5b8]">
                      <KarrayHeartIcon className="h-5 w-5" />
                    </span>

                    <span className="leading-7 text-white/75">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CHATS */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Relacionamento e vendas"
              title="Gerenciamento Profissional de Chats"
              description="Nossa equipe de chatters trabalha para maximizar seus ganhos e fortalecer o relacionamento com seus assinantes."
            />

            <CheckList items={chatItems} />
          </div>
        </section>

        {/* MARKETING */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Visibilidade estratégica"
              title="Marketing em Diversas Plataformas"
              description="Ter sucesso no OnlyFans exige muito mais do que apenas publicar conteúdo. Promovemos sua marca em diversas plataformas."
            />

            <CheckList items={platformItems} />

            <p className="mt-10 max-w-4xl text-lg leading-8 text-[#75656c]">
              Toda estratégia de marketing é personalizada de acordo com sua
              personalidade, nicho e público.
            </p>
          </div>
        </section>

        {/* INFRAESTRUTURA */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Segurança operacional"
              title="Infraestrutura Profissional"
              description="Para proteger sua conta e reduzir riscos, utilizamos uma infraestrutura profissional."
            />

            <CheckList items={infrastructureItems} />
          </div>
        </section>

        {/* CRESCIMENTO */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow="Otimização constante"
              title="Crescimento Contínuo"
              description="Sua conta nunca fica no piloto automático. Monitoramos e aprimoramos continuamente todos os principais elementos do seu negócio."
            />

            <CheckList items={growthItems} />

            <div className="mt-10 rounded-2xl bg-[#f4e5e8] p-8">
              <p className="font-serif text-2xl leading-9 text-[#8f425a]">
                Nosso objetivo é construir uma renda consistente e duradoura, e
                não apenas resultados temporários.
              </p>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-[#412a34] px-6 py-28 text-white lg:px-12">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#e9a5b8]">
              O seu sucesso é o nosso sucesso
            </p>

            <h2 className="mt-6 font-serif text-4xl leading-tight md:text-6xl">
              Uma Parceria Construída Sobre o Sucesso
            </h2>

            <div className="mx-auto mt-8 max-w-4xl space-y-6 text-lg leading-8 text-white/75">
              <p>
                Não medimos nosso sucesso pela quantidade de modelos que
                representamos.
              </p>

              <p>
                Medimos nosso sucesso pela quantidade de modelos que alcançam
                independência financeira, constroem negócios sustentáveis e
                realizam objetivos que jamais imaginaram ser possíveis.
              </p>

              <p>
                Ao entrar para nossa agência, você passa a fazer parte de uma
                equipe verdadeiramente comprometida com o seu sucesso.
              </p>

              <p className="font-semibold text-white">
                Nós não enxergamos nossas modelos apenas como clientes.
              </p>

              <p className="font-semibold text-[#e9a5b8]">
                Nós as enxergamos como parte da nossa família.
              </p>
            </div>

            <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/aplicar"
                className="rounded-full bg-[#c65f7c] px-9 py-4 font-bold uppercase tracking-[0.1em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b]"
              >
                Quero Fazer Parte
              </a>

              <a
                href="/"
                className="rounded-full border border-white/40 px-9 py-4 font-bold uppercase tracking-[0.1em] text-white transition hover:border-[#e9a5b8] hover:text-[#e9a5b8]"
              >
                Voltar ao Início
              </a>
            </div>
          </div>
        </section>
    </main>
  );
}