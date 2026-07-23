const reasons = [
  {
    number: "01",
    title: "Investimos em Você",
    description:
      "Desde o primeiro dia, investimos tempo, experiência, tecnologia e recursos para ajudá-la a construir um negócio profissional e duradouro.",
  },
  {
    number: "02",
    title: "Apenas 30 Modelos",
    description:
      "Limitamos nossa agência para garantir atenção individual, comunicação constante e estratégias realmente personalizadas.",
  },
  {
    number: "03",
    title: "Parceria de Verdade",
    description:
      "Não enxergamos você como apenas mais uma conta. Seu crescimento é tratado como parte essencial do crescimento da nossa agência.",
  },
  {
    number: "04",
    title: "Transparência Total",
    description:
      "Você poderá acompanhar resultados, ganhos, métricas e o desempenho do seu negócio com clareza.",
  },
  {
    number: "05",
    title: "Gestão Profissional",
    description:
      "Administramos estratégia, conteúdo, chats, vendas, marketing, precificação, análise e desenvolvimento da marca.",
  },
  {
    number: "06",
    title: "Crescimento Contínuo",
    description:
      "Sua conta nunca fica no piloto automático. Analisamos resultados e ajustamos as estratégias constantemente.",
  },
];

export default function AgencyDifference() {
  return (
    <section className="overflow-hidden bg-[#f2e4df] px-6 py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
              Por que escolher nossa agência
            </p>

            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.08] text-[#3c2730] md:text-5xl lg:text-6xl">
              Seu negócio merece muito mais do que uma gestão genérica.
            </h2>

            <p className="mt-7 max-w-lg text-base leading-8 text-[#6e5c63]">
              Construímos uma estrutura completa ao redor da sua marca para que
              você possa se concentrar na criação de conteúdo enquanto nossa
              equipe trabalha no crescimento do seu negócio.
            </p>

            <a
              href="/por-que-nos"
              className="mt-9 inline-flex rounded-full bg-[#a94f69] px-8 py-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition duration-300 hover:-translate-y-1 hover:bg-[#8f3f57]"
            >
              Conheça Todos os Benefícios
            </a>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {reasons.map((reason) => (
              <article
                key={reason.number}
                className="group rounded-[1.75rem] border border-[#d8bfc7] bg-[#fffaf7] p-7 shadow-[0_18px_50px_rgba(89,54,67,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(89,54,67,0.12)] md:p-8"
              >
                <div className="flex items-start justify-between gap-5">
                  <p className="font-serif text-4xl text-[#d8a6b4]">
                    {reason.number}
                  </p>

                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8a6b4] text-[#b85f79] transition group-hover:bg-[#b85f79] group-hover:text-white">
                    ↗
                  </span>
                </div>

                <h3 className="mt-10 font-serif text-2xl text-[#3c2730]">
                  {reason.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-[#6e5c63]">
                  {reason.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 overflow-hidden rounded-[2rem] bg-[#482a35] text-white">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
            <div className="border-b border-white/10 p-8 md:p-12 lg:border-b-0 lg:border-r">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#e0a7b7]">
                Distribuição transparente
              </p>

              <h3 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">
                Cada parte tem uma função clara no crescimento da marca.
              </h3>

              <p className="mt-6 max-w-lg leading-8 text-white/70">
                Após as taxas da plataforma, a receita é distribuída de maneira
                clara entre a modelo, a gestão da agência e a empresa responsável
                pelo marketing.
              </p>
            </div>

            <div className="grid sm:grid-cols-3">
              <div className="border-b border-white/10 p-8 sm:border-b-0 sm:border-r md:p-10">
                <p className="font-serif text-5xl text-[#efb1c2]">60%</p>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em]">
                  Modelo
                </p>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  A maior parte da receita pertence à criadora e à sua marca.
                </p>
              </div>

              <div className="border-b border-white/10 p-8 sm:border-b-0 sm:border-r md:p-10">
                <p className="font-serif text-5xl text-[#efb1c2]">20%</p>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em]">
                  Agência
                </p>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  Gestão diária, estratégia, vendas, suporte e otimização.
                </p>
              </div>

              <div className="p-8 md:p-10">
                <p className="font-serif text-5xl text-[#efb1c2]">20%</p>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em]">
                  Marketing
                </p>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  Divulgação, tráfego, campanhas e crescimento da audiência.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}