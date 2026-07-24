import Link from "next/link";
import { redirect } from "next/navigation";

import ModelImporterPanel from "@/components/admin/ModelImporterPanel";
import { createClient } from "@/lib/supabase/server";
import { getModelImporterAutoSave } from "@/lib/adminSettings";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  const role = profile.role as ManagementRole;

  if (role !== "owner" && role !== "administrator") {
    redirect("/login");
  }

  const autoSave = await getModelImporterAutoSave(supabase);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1100px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY Models
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Importar modelo (PDF/imagem)
            </h1>

            <p className="mt-2 text-sm text-white/55">
              Envie um PDF ou imagem com os dados de uma modelo e deixe o
              Claude extrair as informações para você.
            </p>
          </div>

          <Link
            href="/admin/models"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            ← Voltar para modelos
          </Link>
        </header>

        <div className="mt-6">
          <ModelImporterPanel
            initialAutoSave={autoSave}
            isOwner={role === "owner"}
          />
        </div>
      </div>
    </main>
  );
}
