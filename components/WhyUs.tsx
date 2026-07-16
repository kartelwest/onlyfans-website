const features = [
  {
    title: "Estratégia",
    description:
      "Planejamento completo para posicionamento, identidade e crescimento da sua marca.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-8 w-8"
      >
        <path d="M12 3 3.5 8.5 12 21l8.5-12.5L12 3Z" />
        <path d="m3.5 8.5 5.5.5 3-6 3 6 5.5-.5" />
        <path d="M9 9h6l-3 12L9 9Z" />
      </svg>
    ),
  },
  {
    title: "Marketing",
    description:
      "Divulgação em diversas plataformas para atrair fãs reais, qualificados e engajados.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-8 w-8"
      >
        <path d="M4 13V8l13-4v13L4 13Z" />
        <path d="M7 14v5h4l-1-5" />
        <path d="M19 8a3 3 0 0 1 0 5" />
      </svg>
    ),
  },
  {
    title: "Gestão de Chats",
    description:
      "Chatters profissionais focados em relacionamento, retenção e aumento de vendas.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-8 w-8"
      >
        <path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.6-4.3A8.5 8.5 0 1 1 21 11.5Z" />
        <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" />
      </svg>
    ),
  },
  {
    title: "Análise e Otimização",
    description:
      "Acompanhamento de métricas e melhorias contínuas para maximizar os resultados.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-8 w-8"
      >
        <path d="M4 20V10h4v10H4Z" />
        <path d="M10 20V4h4v16h-4Z" />
        <path d="M16 20v-7h4v7h-4Z" />
      </svg>
    ),
  },
  {
    title: "Segurança",
    description:
      "Infraestrutura profissional para proteger sua conta, sua marca e suas informações.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-8 w-8"
      >
        <path d="M12 3 4.5 6v5.5c0 4.8 3.1 7.8 7.5 9.5 4.4-1.7 7.5-4.7 7.5-9.5V6L12 3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    ),
  },
];

export default function WhyUs() {
  return (
    <section className="bg-[#fffaf5] px-6 py-20 text-[#21181c] lg:px-12 lg:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#b85f79]">
            Mais que uma agência
          </p>

          <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl lg:text-6xl">
            Construímos marcas. Transformamos vidas.
          </h2>

          <div className="mx-auto mt-6 flex items-center justify-center gap-3 text-[#b85f79]">
            <span className="h-px w-16 bg-[#d8a6b4]" />
            <span className="text-xl">♕</span>
            <span className="h-px w-16 bg-[#d8a6b4]" />
          </div>
        </div>

        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {features.map((feature) => (
            <article key={feature.title} className="group text-center lg:text-left">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f8e8ec] text-[#b85f79] transition duration-300 group-hover:-translate-y-1 group-hover:bg-[#b85f79] group-hover:text-white lg:mx-0">
                {feature.icon}
              </div>

              <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[#a84f69]">
                {feature.title}
              </h3>

              <p className="mt-4 text-sm leading-7 text-[#5f5358]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center">
          <a
            href="/por-que-nos"
            className="inline-flex rounded-full border border-[#b85f79] px-8 py-4 text-sm font-bold uppercase tracking-[0.1em] text-[#9e4862] transition hover:bg-[#b85f79] hover:text-white"
          >
            Descubra Por Que Somos Diferentes
          </a>
        </div>
      </div>
    </section>
  );
}


