const guidelines: { title: string; items: string[] }[] = [
  {
    title: "Iluminação",
    items: [
      "Grave sempre de frente para a luz, nunca contra a janela ou fonte de luz.",
      "Prefira luz natural ou um ring light; evite ambientes muito escuros.",
    ],
  },
  {
    title: "Resolução e enquadramento",
    items: [
      "Grave na maior resolução disponível no seu celular (mínimo 1080p).",
      "Mantenha o celular estável — use tripé sempre que possível.",
      "Enquadre o conteúdo na vertical para Stories/Reels e na horizontal quando indicado pela equipe.",
    ],
  },
  {
    title: "Áudio",
    items: [
      "Grave em ambientes silenciosos, sem ventiladores, TV ou música de fundo.",
      "Evite vento direto no microfone em gravações externas.",
    ],
  },
  {
    title: "Organização do envio",
    items: [
      "Envie o conteúdo o quanto antes após a gravação, sem editar previamente.",
      "Separe fotos e vídeos por data sempre que possível.",
      "Em caso de dúvida sobre o que gravar, fale com a equipe pelo WhatsApp antes.",
    ],
  },
];

export default function DiretrizesDeGravacaoPage() {
  return (
    <main className="min-h-screen bg-[#0b0a0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#e8b84b]">
          KARAY MODELS
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Diretrizes de Gravação
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/60">
          Siga estas orientações para manter a qualidade do conteúdo enviado
          para o Google Drive.
        </p>

        <div className="mt-8 space-y-6">
          {guidelines.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-[#161219] p-5"
            >
              <h2 className="text-lg font-bold text-[#e8b84b]">
                {section.title}
              </h2>

              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-6 text-white/75"
                  >
                    <span className="text-[#e8b84b]">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
