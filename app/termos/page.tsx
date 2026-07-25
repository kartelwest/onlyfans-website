import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — KARAY Models",
  description:
    "Termos de uso da KARAY Models.",
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-[#fff9f5] px-6 py-24 text-[#39272f] lg:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
          KARAY Models
        </p>

        <h1 className="mt-4 font-serif text-4xl font-bold lg:text-5xl">
          Termos de Uso
        </h1>

        <p className="mt-6 leading-7 text-[#5f5056]">
          Nossos termos de uso estão sendo revisados e atualizados.
          Em breve disponibilizaremos aqui o documento completo com as
          regras, direitos e responsabilidades para uso do site e dos
          serviços da KARAY Models.
        </p>

        <p className="mt-4 leading-7 text-[#5f5056]">
          Se tiver dúvidas sobre os termos ou sobre nossos serviços,
          entre em contato conosco pelo WhatsApp ou pelo e-mail indicado
          no rodapé do site.
        </p>
      </div>
    </main>
  );
}
