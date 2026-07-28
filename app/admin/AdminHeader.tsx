"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";

export default function AdminHeader() {
  const pathname = usePathname();

  const portal = getPortalLabel(pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0d]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
            {portal.title}
          </p>

          <p className="mt-1 text-sm text-white/50">
            {portal.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pathname?.startsWith("/admin/models") && (
            <Link
              href="/admin/socialmediamodels"
              className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-5 py-3 text-sm font-semibold text-pink-200 transition hover:bg-pink-500/20"
            >
              MÍDIA SOCIAL
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

function getPortalLabel(pathname: string | null): { title: string; subtitle: string } {
  if (pathname?.startsWith("/admin/socialmediamodels")) {
    return {
      title: "PORTAL DE MÍDIA SOCIAL",
      subtitle: "Painel de crescimento de marca e mídia social",
    };
  }

  if (pathname?.startsWith("/admin/models")) {
    return {
      title: "PORTAL DE MODELOS",
      subtitle: "Painel de gestão OnlyFans",
    };
  }

  return {
    title: "KARAY MODELS CRM",
    subtitle: "Proprietário / Administrador",
  };
}
