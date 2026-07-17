import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#2f1d25] px-6 pb-8 pt-16 text-white lg:px-12 lg:pt-20">
      <div className="mx-auto max-w-[1300px]">
        <div className="grid gap-12 border-b border-white/15 pb-14 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.9fr]">
          {/* ABOUT US */}
          <div>
            <Image
              src="/images/karray-logo.png"
              alt="KARAY Models"
              width={330}
              height={130}
              className="h-auto w-[230px] object-contain"
            />

            <h2 className="mt-7 font-serif text-3xl text-white">
              Sobre Nós
            </h2>

            <p className="mt-5 max-w-xl leading-8 text-white/70">
              KARAY Models é uma agência especializada na gestão completa de
              criadoras de conteúdo. Nosso objetivo é transformar talento em um
              negócio lucrativo através de estratégias profissionais de
              marketing, posicionamento de marca, gerenciamento de contas,
              atendimento aos assinantes e crescimento sustentável.
            </p>

            <p className="mt-4 max-w-xl leading-8 text-white/70">
              Limitamos nossa agência a apenas 30 modelos para garantir um
              atendimento personalizado e oferecer o mais alto nível de suporte
              a cada criadora.
            </p>
          </div>

          {/* NAVIGATION */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#e9a5b8]">
              Navegação
            </h3>

            <nav className="mt-6 flex flex-col gap-4 text-white/70">
              <a
                href="/"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                Início
              </a>

              <a
                href="/por-que-nos"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                Por Que Nós
              </a>

              <a
                href="/faq"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                Perguntas Frequentes
              </a>

              <a
                href="/aplicar"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                Candidate-se
              </a>

              <a
                href="/contato"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                 Área da Modelo
              </a>
            </nav>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#e9a5b8]">
              Contato
            </h3>

            <div className="mt-6 space-y-8 text-white/70">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  Atendimento
                </p>

                <p className="mt-2 leading-7">
                  Atendemos modelos em todo o Brasil, América Latina e outros
                  países. Todo o processo de recrutamento, gerenciamento e
                  suporte é realizado de forma totalmente online.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  WhatsApp
                </p>

                <a
                  href="https://wa.me/13124702299"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 transition hover:text-[#e9a5b8]"
                  aria-label="Falar com a KARAY Models pelo WhatsApp"
                >
                  +1 (312) 470-2299 (WhatsApp)
                </a>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Utilize este número para esclarecer dúvidas, obter
                  informações sobre a agência ou acompanhar sua candidatura.
                </p>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  Nossa equipe normalmente responde em até 24 horas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div className="flex flex-col gap-4 pt-8 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© KARAY Models. Todos os direitos reservados.</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href="/privacidade"
              className="transition hover:text-[#e9a5b8]"
            >
              Política de Privacidade
            </a>

            <a
              href="/termos"
              className="transition hover:text-[#e9a5b8]"
            >
              Termos de Uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}