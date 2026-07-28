import Link from "next/link";
import { requireAdminAmpliaAccess } from "@/lib/amplia/admin";
import { getAmpliaClients } from "@/lib/amplia/clients";

export const dynamic = "force-dynamic";

export default async function AdminSocialMediaOverviewPage() {
  await requireAdminAmpliaAccess();

  const { stats } = await getAmpliaClients();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              PORTAL DA AMPLIA
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Visão Geral
            </h1>

            <p className="mt-2 text-sm text-white/55">
              Painel de crescimento de marca e mídia social.
            </p>
          </div>

          <Link
            href="/admin/socialmediamodels/models"
            className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400"
          >
            Open Now — SOCIAL MEDIA MODELS
          </Link>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Modelos em mídia social" value={stats.activeSocialModels} description="Ativos" />
          <MetricCard label="Clientes Brand-Growth-only" value={stats.brandGrowthOnlyClients} description="Não-OnlyFans" />
          <MetricCard label="Instagram conectado" value={stats.connectedInstagram} description="Contas ativas" />
          <MetricCard label="Aguardando lançamento" value={stats.awaitingLaunch} description="Setup pendente" />
          <MetricCard label="Aguardando autorização" value={stats.awaitingAuthorization} description="OAuth/verificação" />
          <MetricCard label="Conteúdo para aprovação" value={stats.contentAwaitingApproval} description="Cliente/agência" />
          <MetricCard label="Posts agendados hoje" value={stats.postsScheduledToday} description="Instagram" />
          <MetricCard label="Playbook concluído hoje" value={stats.playbookCompletedToday} description="X manual" />
          <MetricCard label="Playbook pendente hoje" value={stats.playbookPendingToday} description="X manual" />
          <MetricCard label="Falhas de publicação (24h)" value={stats.publishingFailures24h} description="Requer atenção" />
          <MetricCard label="Contas abaixo da baseline" value={stats.accountsNeedingAttention} description="Restritas/suspensas" />
          <MetricCard label="Alertas críticos" value={stats.criticalAlerts} description="Ação imediata" />
        </section>

        <section className="mt-8 rounded-2xl border border-pink-400/20 bg-[#111115] p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            Resumo mensal
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Crescimento de seguidores" value={stats.recentFollowerGrowth} description="Últimos 30 dias" />
            <MetricCard label="Escassez de conteúdo" value={stats.contentShortages} description="Baixo estoque" />
            <MetricCard label="Custo estimado de IA" value={stats.estimatedAICostMonth} description="Este mês (USD)" />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111115] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-bold text-pink-300">{value}</p>
      <p className="mt-2 text-xs text-white/45">{description}</p>
    </div>
  );
}
