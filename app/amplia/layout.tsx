import Link from "next/link";

import AmpliaNav from "@/components/amplia/AmpliaNav";
import LogoutButton from "@/components/LogoutButton";
import { requireAmpliaAccess } from "@/lib/amplia/auth";
import { getAmpliaConfig } from "@/lib/amplia/config";
import { createClient } from "@/lib/supabase/server";

export default async function AmpliaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAmpliaAccess();

  const supabase = await createClient();
  const config = await getAmpliaConfig(supabase);

  return (
    <div className="min-h-screen bg-[#0a0810]">
      <header className="sticky top-0 z-50 border-b border-purple-400/20 bg-[#0d0a15]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-300">
              KARAY Models CRM · {config.moduleCodeName}
            </p>

            <h1 className="mt-1 text-2xl font-bold text-white">
              {config.displayName}
            </h1>

            <p className="mt-1 text-sm text-white/50">
              {session.role === "owner" ? "Proprietário" : "Administrador"} ·{" "}
              {session.fullName || "—"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/models"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              ← Voltar ao CRM
            </Link>

            <LogoutButton />
          </div>
        </div>

        <AmpliaNav />
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8 text-white">
        {children}
      </main>
    </div>
  );
}
