import { redirect } from "next/navigation";
import Link from "next/link";

import { type RepresentativeModel } from "@/components/admin/RepresentativeModelsDropdown";

import { createClient } from "@/lib/supabase/server";
import RepresentativesClient from "./RepresentativesClient";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "ativa", label: "Ativa" },
  { value: "inativa", label: "Inativa" },
  { value: "arquivada", label: "Arquivada" },
] as const;

type RepresentativeRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  active: boolean | null;
  last_login_at: string | null;
  status_changed_at: string | null;
  created_at: string | null;
};

export default async function RepresentativesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("admin.representatives.page");
  const { status: statusParam } = await searchParams;

  const statusFilter = STATUS_OPTIONS.some((option) => option.value === statusParam)
    ? (statusParam as typeof STATUS_OPTIONS[number]["value"])
    : "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active || (profile.role !== "owner" && profile.role !== "administrator")) {
    redirect("/login");
  }

  const isOwner = profile.role === "owner";

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, status, active, last_login_at, status_changed_at, created_at",
    )
    .eq("role", "representative")
    .order("full_name", { ascending: true });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: representatives, error } = await query;

  if (error) {
    console.error("Erro ao carregar representantes:", error);
  }

  const representativeIds = ((representatives ?? []) as RepresentativeRow[]).map((row) => row.id);

  // The models themselves, not just how many: each row carries a dropdown
  // that opens the model as HER representative sees her.
  const { data: modelRows } = await supabase
    .from("models")
    .select(
      "id, slug, display_name, stage_name, status, active, onboarding_percentage, representative_id",
    )
    .in(
      "representative_id",
      representativeIds.length > 0
        ? representativeIds
        : ["00000000-0000-0000-0000-000000000000"],
    )
    .order("display_name", { ascending: true });

  const modelsByRepresentative = new Map<string, RepresentativeModel[]>();

  for (const row of modelRows ?? []) {
    if (!row.representative_id) {
      continue;
    }

    const list = modelsByRepresentative.get(row.representative_id) ?? [];

    list.push(row as unknown as RepresentativeModel);

    modelsByRepresentative.set(row.representative_id, list);
  }

  return (
    <main className="min-h-screen bg-[#0b0a0d] pb-16 text-white">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
              {t("eyebrow")}
            </p>

            <h1 className="mt-2 text-3xl font-bold">{t("title")}</h1>

            <p className="mt-2 max-w-2xl text-sm text-white/50">
              {t("intro")}
            </p>
          </div>

          <Link
            href="/admin/users/new?role=representative"
            className="rounded-xl bg-pink-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-pink-400"
          >
            {t("add")}
          </Link>
        </div>

        <RepresentativesClient
          initialStatusFilter={statusFilter}
          representatives={(representatives ?? []) as RepresentativeRow[]}
          modelsByRepresentative={modelsByRepresentative}
          isOwner={isOwner}
        />
      </div>
    </main>
  );
}
