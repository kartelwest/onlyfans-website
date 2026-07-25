import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — KARAY Models",
  description:
    "Política de privacidade da KARAY Models.",
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#fff9f5] px-6 py-24 text-[#39272f] lg:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
          KARAY Models
        </p>

        <h1 className="mt-4 font-serif text-4xl font-bold lg:text-5xl">
          Política de Privacidade
        </h1>

        <p className="mt-6 leading-7 text-[#5f5056]">
          Nossa política de privacidade está sendo revisada e atualizada.
          Em breve disponibilizaremos aqui o texto completo com todas as
          informações sobre como coletamos, usamos, armazenamos e protegemos
          seus dados.
        </p>

        <p className="mt-4 leading-7 text-[#5f5056]">
          Se tiver dúvidas sobre o tratamento dos seus dados pessoais,
          entre em contato conosco pelo WhatsApp ou pelo e-mail indicado
          no rodapé do site.
        </p>
      </div>
    </main>
  );
}
