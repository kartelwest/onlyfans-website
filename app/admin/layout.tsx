import Link from "next/link";

import LogoutButton from "@/components/LogoutButton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#08080a]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0d]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY MODELS CRM
            </p>

            <p className="mt-1 text-sm text-white/50">
              Proprietário / Administrador
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/amplia"
              className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-5 py-3 text-sm font-semibold text-pink-200 transition hover:bg-pink-500/20"
            >
              Amplia
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}