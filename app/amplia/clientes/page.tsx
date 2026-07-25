import Link from "next/link";

import EnrollModelForm from "@/components/amplia/EnrollModelForm";
import NewBrandGrowthClientForm from "@/components/amplia/NewBrandGrowthClientForm";
import PageHeader from "@/components/amplia/PageHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TalentRow = {
  id: string;
  stage_name: string;
  display_name: string;
  linked_model_id: string | null;
  active: boolean;
  brand_profiles: { niche_1: string; status: string }[] | null;
  service_enrollments:
    | {
        status: string;
        service_type: { key: string; display_name: string } | null;
      }[]
    | null;
};

export default async function ClientesPage() {
  const supabase = await createClient();

  const { data: talentRows, error } = await supabase
    .from("talents")
    .select(
      `
        id, stage_name, display_name, linked_model_id, active,
        brand_profiles ( niche_1, status ),
        service_enrollments ( status, service_type:service_types ( key, display_name ) )
      `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar clientes do Amplia:", error);
  }

  const talents = (talentRows ?? []) as unknown as TalentRow[];

  const linkedModelIds = new Set(
    talents.map((t) => t.linked_model_id).filter((id): id is string => !!id),
  );

  const { data: modelRows } = await supabase
    .from("models")
    .select("id, display_name, stage_name")
    .eq("active", true)
    .order("display_name", { ascending: true });

  const eligibleModels = (modelRows ?? [])
    .filter((model) => !linkedModelIds.has(model.id))
    .map((model) => ({
      id: model.id,
      label: model.stage_name
        ? `${model.display_name} (${model.stage_name})`
        : model.display_name,
    }));

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Clientes Brand Growth: modelos OnlyFans que também querem crescimento de marca, e clientes exclusivos de Brand Growth (atrizes, influenciadoras, marcas)."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <details className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <summary className="cursor-pointer list-none border-b border-purple-400/20 bg-[#1c1730] px-6 py-4 text-sm font-bold uppercase tracking-[0.1em] text-purple-100 [&::-webkit-details-marker]:hidden">
            + Nova cliente exclusiva de Brand Growth
          </summary>

          <div className="p-6">
            <NewBrandGrowthClientForm />
          </div>
        </details>

        <details className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
          <summary className="cursor-pointer list-none border-b border-purple-400/20 bg-[#1c1730] px-6 py-4 text-sm font-bold uppercase tracking-[0.1em] text-purple-100 [&::-webkit-details-marker]:hidden">
            + Inscrever modelo existente no Brand Growth
          </summary>

          <div className="p-6">
            <EnrollModelForm eligibleModels={eligibleModels} />
          </div>
        </details>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#111115]">
        <div className="border-b border-purple-400/20 bg-[#1c1730] px-6 py-4">
          <p className="text-sm font-bold uppercase tracking-[0.1em] text-purple-100">
            Todas as clientes ({talents.length})
          </p>
        </div>

        {talents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-bold">Nenhuma cliente cadastrada</p>
            <p className="mt-2 text-sm text-white/50">
              Crie uma cliente exclusiva de Brand Growth ou inscreva uma
              modelo existente para começar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="bg-[#1c1730] text-left">
                <tr className="border-b border-purple-400/20">
                  <Th>Cliente</Th>
                  <Th>Trilha</Th>
                  <Th>Nicho</Th>
                  <Th>Serviços</Th>
                  <Th>Perfil de marca</Th>
                </tr>
              </thead>

              <tbody>
                {talents.map((talent) => {
                  const profile = talent.brand_profiles?.[0] ?? null;

                  return (
                    <tr
                      key={talent.id}
                      className="border-b border-white/10 transition hover:bg-white/[0.03]"
                    >
                      <Td>
                        <Link
                          href={`/amplia/clientes/${talent.id}`}
                          className="font-bold text-white transition hover:text-purple-300"
                        >
                          {talent.display_name}
                        </Link>

                        {talent.stage_name !== talent.display_name && (
                          <p className="mt-1 text-xs text-white/45">
                            {talent.stage_name}
                          </p>
                        )}
                      </Td>

                      <Td>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                            talent.linked_model_id
                              ? "bg-pink-500/10 text-pink-300 ring-pink-500/30"
                              : "bg-purple-500/10 text-purple-300 ring-purple-500/30"
                          }`}
                        >
                          {talent.linked_model_id
                            ? "OnlyFans + Brand Growth"
                            : "Brand Growth exclusivo"}
                        </span>
                      </Td>

                      <Td>
                        <span className="text-sm text-white/70">
                          {profile?.niche_1 ?? "—"}
                        </span>
                      </Td>

                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {(talent.service_enrollments ?? [])
                            .filter((e) => e.service_type)
                            .map((enrollment, index) => (
                              <span
                                key={index}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/60"
                              >
                                {enrollment.service_type?.display_name} ·{" "}
                                {enrollment.status}
                              </span>
                            ))}
                        </div>
                      </Td>

                      <Td>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                            profile?.status === "active"
                              ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                              : "bg-white/5 text-white/45 ring-white/15"
                          }`}
                        >
                          {profile?.status ?? "sem perfil"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-purple-100">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-middle">{children}</td>;
}
