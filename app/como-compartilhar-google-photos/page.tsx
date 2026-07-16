const iphoneSteps = [
  {
    number: "01",
    title: "Abra o Google Photos",
    text: "Abra o aplicativo Google Photos no seu iPhone. Caso ainda não tenha o aplicativo, instale-o pela App Store e entre com sua conta Google.",
  },
  {
    number: "02",
    title: "Selecione as quatro fotos",
    text: "Escolha duas fotos verticais e duas fotos horizontais recentes. Não é necessário enviar conteúdo sensual.",
  },
  {
    number: "03",
    title: "Crie um álbum",
    text: 'Toque em “Adicionar a” ou no símbolo de “+” e escolha “Álbum”. Dê ao álbum o nome “Candidatura KARRAY Models”.',
  },
  {
    number: "04",
    title: "Confira o álbum",
    text: "Abra o álbum e confirme que as quatro fotos aparecem corretamente.",
  },
  {
    number: "05",
    title: "Compartilhe o álbum",
    text: 'Toque no ícone de compartilhar. Em seguida, escolha “Criar link”, “Obter link” ou “Compartilhar link”.',
  },
  {
    number: "06",
    title: "Copie o link",
    text: "Copie o link criado pelo Google Photos e volte ao formulário da KARRAY Models.",
  },
  {
    number: "07",
    title: "Cole o link no formulário",
    text: "Cole o link no campo indicado na candidatura e confirme que ele começa com photos.app.goo.gl ou photos.google.com.",
  },
];

const androidSteps = [
  {
    number: "01",
    title: "Abra o Google Photos",
    text: "Abra o aplicativo Google Photos no seu celular Android e confirme que está conectada à sua conta Google.",
  },
  {
    number: "02",
    title: "Selecione as quatro fotos",
    text: "Escolha duas fotos verticais e duas fotos horizontais recentes, nítidas e sem filtros que alterem significativamente sua aparência.",
  },
  {
    number: "03",
    title: "Crie um álbum",
    text: 'Toque em “Adicionar a”, “+” ou “Novo” e selecione “Álbum”. Nomeie o álbum como “Candidatura KARRAY Models”.',
  },
  {
    number: "04",
    title: "Confira o álbum",
    text: "Abra o álbum e confirme que todas as quatro fotos estão presentes.",
  },
  {
    number: "05",
    title: "Crie o link",
    text: 'Toque em “Compartilhar” e depois em “Criar link”. Em alguns aparelhos, a opção poderá aparecer como “Obter link”.',
  },
  {
    number: "06",
    title: "Copie o link",
    text: "Toque em “Copiar link” e retorne ao formulário de candidatura.",
  },
  {
    number: "07",
    title: "Cole o link no formulário",
    text: "Cole o link no campo do Google Photos e prossiga com o restante da candidatura.",
  },
];

function PhoneIllustration({
  type,
}: {
  type: "iphone" | "android";
}) {
  return (
    <div className="mx-auto flex h-[310px] w-[170px] items-center justify-center rounded-[2.2rem] border-[7px] border-[#3a252e] bg-white p-3 shadow-sm">
      <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] bg-[#f8e9ed]">
        <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-[#3a252e]" />

        <div className="px-4 pt-10">
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-[#9d4861]">
            Google Photos
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-16 rounded-lg bg-[#deb5c1]" />
            <div className="h-16 rounded-lg bg-[#c9879a]" />
            <div className="h-12 rounded-lg bg-[#ebd0d7]" />
            <div className="h-12 rounded-lg bg-[#b85f79]" />
          </div>

          <div className="mt-5 rounded-xl bg-white p-3">
            <p className="text-center text-[10px] font-semibold text-[#66565d]">
              Compartilhar álbum
            </p>

            <div className="mx-auto mt-3 h-8 w-20 rounded-full bg-[#c65f7c]" />
          </div>

          <p className="mt-4 text-center text-[10px] text-[#75656c]">
            {type === "iphone" ? "Exemplo no iPhone" : "Exemplo no Android"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[#ead8df] bg-white p-6">
      <div className="flex items-start gap-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4e5e8] font-serif text-lg text-[#b85f79]">
          {number}
        </span>

        <div>
          <h3 className="font-serif text-2xl text-[#39272f]">{title}</h3>

          <p className="mt-3 leading-7 text-[#75656c]">{text}</p>
        </div>
      </div>
    </article>
  );
}

export default function GooglePhotosInstructionsPage() {
  return (
    <main className="bg-[#fff9f5] text-[#39272f]">
      <section className="bg-[#412a34] px-6 pb-20 pt-56 text-white lg:px-12 lg:pt-64">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#e9a5b8]">
            Instruções para sua candidatura
          </p>

          <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">
            Como compartilhar suas fotos pelo Google Photos
          </h1>

          <p className="mt-7 max-w-3xl text-lg leading-8 text-white/75">
            Crie um álbum contendo duas fotos verticais e duas fotos
            horizontais. Depois, copie o link compartilhável e cole-o no
            formulário da KARRAY Models.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="rounded-[2rem] border border-[#e5cad3] bg-[#f4e5e8] p-7 md:p-9">
            <h2 className="font-serif text-3xl">Antes de começar</h2>

            <ul className="mt-6 space-y-3 leading-7 text-[#66565d]">
              <li>• Escolha duas fotos verticais recentes.</li>
              <li>• Escolha duas fotos horizontais recentes.</li>
              <li>• Use fotos nítidas e sem filtros exagerados.</li>
              <li>• Não é necessário enviar conteúdo sensual.</li>
              <li>
                • Confirme que qualquer pessoa com o link pode visualizar o
                álbum.
              </li>
            </ul>
          </div>

          <section className="mt-20">
            <div className="grid gap-12 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b85f79]">
                  Apple iPhone
                </p>

                <h2 className="mt-4 font-serif text-4xl">
                  Instruções para iPhone
                </h2>

                <div className="mt-8">
                  <PhoneIllustration type="iphone" />
                </div>
              </div>

              <div className="grid gap-4">
                {iphoneSteps.map((step) => (
                  <StepCard key={step.number} {...step} />
                ))}
              </div>
            </div>
          </section>

          <section className="mt-24 border-t border-[#ead8df] pt-20">
            <div className="grid gap-12 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b85f79]">
                  Celulares Android
                </p>

                <h2 className="mt-4 font-serif text-4xl">
                  Instruções para Android
                </h2>

                <div className="mt-8">
                  <PhoneIllustration type="android" />
                </div>
              </div>

              <div className="grid gap-4">
                {androidSteps.map((step) => (
                  <StepCard key={step.number} {...step} />
                ))}
              </div>
            </div>
          </section>

          <section className="mt-20 rounded-[2rem] bg-[#412a34] p-8 text-white md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e9a5b8]">
                  Verificação final
                </p>

                <h2 className="mt-4 font-serif text-3xl md:text-4xl">
                  Teste o link antes de enviar
                </h2>

                <p className="mt-5 max-w-3xl leading-8 text-white/70">
                  Abra o link em uma janela anônima ou envie-o para uma pessoa de
                  confiança. Se as fotos aparecerem sem pedir permissão, o link
                  está configurado corretamente.
                </p>
              </div>

              <a
                href="/aplicar"
                className="rounded-full bg-[#c65f7c] px-8 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b]"
              >
                Voltar à candidatura
              </a>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}