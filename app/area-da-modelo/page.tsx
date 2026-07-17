import Link from "next/link";
import { loginModel } from "./actions";

type AreaDaModeloPageProps = {
  searchParams: Promise<{
    erro?: string;
  }>;
};

function getErrorMessage(error?: string) {
  if (error === "campos") {
    return "Digite seu nome de usuário e sua senha.";
  }

  if (error === "credenciais") {
    return "Usuário ou senha incorretos. Verifique seus dados e tente novamente.";
  }

  return null;
}

export default async function AreaDaModeloPage({
  searchParams,
}: AreaDaModeloPageProps) {
  const { erro } = await searchParams;
  const errorMessage = getErrorMessage(erro);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090b] px-6 pb-20 pt-44 text-white lg:pt-52">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#d88ca4]/10 blur-[140px]"
      />

      <section className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#d88ca4]">
            Portal exclusivo
          </p>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Área da Modelo
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
            Acesse sua área privada para enviar fotos e vídeos diretamente para
            nossa equipe.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-xl">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-7 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold sm:text-3xl">
                Acesse sua conta
              </h2>

              <p className="mt-3 leading-7 text-white/55">
                Digite o usuário e a senha fornecidos pela agência.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-6 rounded-2xl border border-red-400/25 bg-red-400/10 px-5 py-4 text-sm leading-6 text-red-200"
              >
                {errorMessage}
              </div>
            )}

            <form action={loginModel} className="space-y-6">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-semibold text-white/80"
                >
                  Usuário
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Digite seu usuário"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#d88ca4]/70 focus:ring-4 focus:ring-[#d88ca4]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-white/80"
                >
                  Senha
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#d88ca4]/70 focus:ring-4 focus:ring-[#d88ca4]/10"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#d88ca4] px-7 py-4 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:scale-[1.01] hover:bg-[#efadc0] active:scale-[0.99]"
              >
                Entrar
              </button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-7 text-center">
              <p className="text-sm leading-6 text-white/50">
                Está com problemas para acessar sua conta?
              </p>

              <a
                href="https://wa.me/13124702299?text=Ol%C3%A1%21%20Estou%20com%20problemas%20para%20acessar%20a%20%C3%81rea%20da%20Modelo."
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-[#e9a5b8] transition hover:text-[#f4c0cf]"
              >
                Falar com nossa equipe pelo WhatsApp
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-xs uppercase tracking-[0.16em] text-white/30">
            Acesso exclusivo para modelos ativas
          </p>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-sm text-white/45 transition hover:text-white"
            >
              Voltar para o site
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}