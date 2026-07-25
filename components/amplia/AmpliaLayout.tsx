"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/amplia", label: "Visão Geral" },
  { href: "/amplia/clientes", label: "Clientes" },
  { href: "/amplia/contas", label: "Contas Sociais" },
  { href: "/amplia/estrategia", label: "Estratégia" },
  { href: "/amplia/conteudo", label: "Conteúdo" },
  { href: "/amplia/calendario", label: "Calendário" },
  { href: "/amplia/aprovacoes", label: "Aprovações" },
  { href: "/amplia/publicacoes", label: "Publicações" },
  { href: "/amplia/resultados", label: "Resultados" },
  { href: "/amplia/pesquisa", label: "Pesquisa" },
  { href: "/amplia/alertas", label: "Alertas" },
  { href: "/amplia/configuracoes", label: "Configurações" },
  { href: "/amplia/auditoria", label: "Auditoria" },
];

export function AmpliaLayout({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0d]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              Amplia
            </p>
            <p className="mt-1 text-sm text-white/50">Brand Growth</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/models"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10"
            >
              ← CRM
            </Link>
            {actions}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <nav className="flex gap-2 overflow-x-auto pb-4">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-pink-400/50 bg-pink-500/20 text-pink-200"
                    : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <main className="mt-6">
          <h1 className="text-3xl font-bold">{title}</h1>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111115] p-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pink-300">
        {title}
      </p>
      <p className="mt-3 text-white/50">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-pink-100">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
