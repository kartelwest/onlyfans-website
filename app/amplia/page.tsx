import Link from "next/link";

import EmptyState from "@/components/amplia/EmptyState";
import { getAmpliaConfig } from "@/lib/amplia/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AmpliaOverviewPage() {
  const supabase = await createClient();
  const config = await getAmpliaConfig(supabase);

  const { count: talentsCount } = await supabase
    .from("talents")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const { data: enrollmentRows } = await supabase
    .from("service_enrollments")
    .select("status, service_type:service_types(key)");

  const igActive =
    enrollmentRows?.filter(
      (row) =>
        (row.service_type as unknown as { key: string } | null)?.key ===
          "brand_growth_instagram" && row.status === "active",
    ).length ?? 0;

  const xActive =
    enrollmentRows?.filter(
      (row) =>
        (row.service_type as unknown as { key: string } | null)?.key ===
          "brand_growth_x" && row.status === "active",
    ).length ?? 0;

  return (
    <div>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-300">
          Visão Geral
        </p>

        <h2 className="text-3xl font-bold">
          {config.displayName} — painel de exceções
        </h2>

        <p className="max-w-2xl text-sm text-white/55">
          Esta tela prioriza o que precisa de atenção humana: contas com
          problemas, conteúdo aguardando aprovação e alertas críticos. A
          maioria dos indicadores abaixo ainda está vazia — as funcionalidades
          de contas sociais, conteúdo, publicação e alertas chegam nas
          próximas fases.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Clientes Brand Growth ativos"
          value={talentsCount ?? 0}
          description="Talentos cadastrados no Amplia"
        />

        <MetricCard
          label="Contas Instagram ativas"
          value={igActive}
          description="Enrollments com status ativo"
        />

        <MetricCard
          label="Contas X"
          value={`${xActive} (desativado)`}
          description={
            config.featureXEnabled
              ? "API do X ativa"
              : "Layer 1 (API) inativa — playbook manual"
          }
        />

        <MetricCard
          label="Alertas críticos"
          value="—"
          description="Disponível a partir da Fase 7"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="Contas aguardando lançamento ou autorização"
          description="O Account Launch Center chega na Fase 2."
        />

        <EmptyState
          title="Conteúdo aguardando aprovação"
          description="O Content Studio chega na Fase 3."
        />

        <EmptyState
          title="Publicações agendadas hoje / falhas de publicação"
          description="A publicação via API do Instagram chega na Fase 4."
        />

        <EmptyState
          title="Escassez de conteúdo e ações recomendadas"
          description="O motor de otimização e alertas chegam nas Fases 6 e 7."
        />
      </section>

      <section className="mt-6 rounded-2xl border border-purple-400/20 bg-[#15111d] p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-purple-300">
          Próximo passo
        </p>

        <p className="mt-2 text-sm text-white/70">
          Cadastre um cliente Brand Growth (novo ou a partir de uma modelo
          existente) para começar a preencher o perfil de marca, consentimentos
          e limites.
        </p>

        <Link
          href="/amplia/clientes"
          className="mt-4 inline-flex rounded-xl bg-purple-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-400"
        >
          Ir para Clientes
        </Link>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111115] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-purple-300">{value}</p>

      <p className="mt-2 text-xs text-white/45">{description}</p>
    </div>
  );
}
