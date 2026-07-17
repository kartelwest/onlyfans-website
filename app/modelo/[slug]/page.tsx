import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getModelBySlug } from "@/lib/models";

type ModelPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ModelPage({ params }: ModelPageProps) {
  const { slug } = await params;
  const model = getModelBySlug(slug.toLowerCase());

  if (!model) {
    notFound();
  }

  const cookieStore = await cookies();
  const authorizedModel = cookieStore.get("karay-model")?.value;

  if (authorizedModel !== model.slug) {
    redirect("/area-da-modelo");
  }

  const folders = [
    {
      title: "OnlyFans",
      abbreviation: "OF",
      description:
        "Envie aqui as fotos e os vídeos que serão utilizados na sua conta do OnlyFans.",
      href: model.folders.onlyfans,
    },
    {
      title: "Instagram",
      abbreviation: "IG",
      description:
        "Envie aqui fotos, vídeos, Reels, Stories e outros conteúdos destinados ao Instagram.",
      href: model.folders.instagram,
    },
    {
      title: "X / Twitter",
      abbreviation: "X",
      description:
        "Envie aqui as fotos, os vídeos e os demais materiais destinados ao X / Twitter.",
      href: model.folders.twitter,
    },
  ];

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 pb-20 pt-44 text-white lg:pt-52">
      <section className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Envio de conteúdo
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/70 sm:text-lg">
            Olá, {model.name}. Utilize os botões abaixo para enviar seu conteúdo
            diretamente para as pastas da agência no Google Drive.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {folders.map((folder) => {
            const isConnected = folder.href.trim().length > 0;

            return (
              <article
                key={folder.title}
                className="flex min-h-[330px] flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d88ca4] text-lg font-bold text-black">
                  {folder.abbreviation}
                </div>

                <h2 className="text-2xl font-bold">{folder.title}</h2>

                <p className="mt-4 flex-1 leading-7 text-white/65">
                  {folder.description}
                </p>

                {isConnected ? (
                  <a
                    href={folder.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex items-center justify-center rounded-full bg-[#d88ca4] px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-black transition hover:scale-[1.02] hover:bg-[#efadc0]"
                  >
                    Abrir pasta no Google Drive
                  </a>
                ) : (
                  <div className="mt-8 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white/40">
                    Pasta em configuração
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.04] p-8 sm:p-10">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Instruções para o envio
          </h2>

          <div className="mt-8 grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-[#e9a5b8]">
                Antes de enviar
              </h3>

              <ul className="mt-4 space-y-3 leading-7 text-white/70">
                <li>• Envie os arquivos em qualidade original.</li>
                <li>• Não adicione filtros ou marcas d&apos;água.</li>
                <li>• Não envie capturas de tela.</li>
                <li>• Não comprima as fotos ou os vídeos.</li>
                <li>• Utilize Wi-Fi sempre que possível.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#e9a5b8]">
                Como enviar
              </h3>

              <ul className="mt-4 space-y-3 leading-7 text-white/70">
                <li>• Escolha a plataforma correta.</li>
                <li>• Clique no botão para abrir o Google Drive.</li>
                <li>• Clique em “Novo” ou “Upload de arquivo”.</li>
                <li>• Selecione todas as fotos e os vídeos.</li>
                <li>• Aguarde o upload terminar antes de fechar.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[#d88ca4]/30 bg-[#d88ca4]/10 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold">Terminou o envio?</h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/70">
            Depois de enviar todo o conteúdo, avise nossa equipe pelo WhatsApp
            para confirmarmos o recebimento.
          </p>

          <a
            href={`https://wa.me/13124702299?text=${encodeURIComponent(
              `Olá! Sou ${model.name} e acabei de enviar meu conteúdo para o Google Drive.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center justify-center rounded-full border border-[#d88ca4] px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#e9a5b8] transition hover:bg-[#d88ca4] hover:text-black"
          >
            Avisar pelo WhatsApp
          </a>
        </section>
      </section>
    </main>
  );
}