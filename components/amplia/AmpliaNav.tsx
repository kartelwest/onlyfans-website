"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Visão Geral", href: "/amplia" },
  { label: "Clientes", href: "/amplia/clientes" },
  { label: "Contas Sociais", href: "/amplia/contas-sociais" },
  { label: "Estratégia", href: "/amplia/estrategia" },
  { label: "Conteúdo", href: "/amplia/conteudo" },
  { label: "Calendário", href: "/amplia/calendario" },
  { label: "Aprovações", href: "/amplia/aprovacoes" },
  { label: "Publicações", href: "/amplia/publicacoes" },
  { label: "Resultados", href: "/amplia/resultados" },
  { label: "Pesquisa", href: "/amplia/pesquisa" },
  { label: "Alertas", href: "/amplia/alertas" },
  { label: "Configurações", href: "/amplia/configuracoes" },
  { label: "Auditoria", href: "/amplia/auditoria" },
];

export default function AmpliaNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-purple-400/20 bg-[#15111d] px-6 py-4">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/amplia"
            ? pathname === "/amplia"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
              isActive
                ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
