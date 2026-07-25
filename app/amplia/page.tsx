import Link from "next/link";
import { AmpliaLayout, Card, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AmpliaOverviewPage() {
  await requireAmpliaAccess();

  const supabase = await createClient();

  const { count: totalClients } = await supabase
    .from("brand_profiles")
    .select("*", { count: "exact", head: true });

  const { data: activeAccounts } = await supabase
    .from("social_accounts")
    .select("platform, status")
    .in("status", ["connected", "active"]);

  const instagramConnected = activeAccounts?.filter((a) => a.platform === "instagram").length ?? 0;
  const xConnected = activeAccounts?.filter((a) => a.platform === "x").length ?? 0;

  const { data: pendingApprovals } = await supabase
    .from("content_items")
    .select("id")
    .in("status", ["awaiting_client_approval", "awaiting_agency_approval"]);

  return (
    <AmpliaLayout
      title="Visão Geral"
      actions={
        <Link
          href="/amplia/clientes/novo"
          className="rounded-xl bg-pink-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-pink-400"
        >
          + Novo cliente
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Clientes ativos" value={totalClients ?? 0} description="Brand Growth" />
        <Metric label="Instagram conectado" value={instagramConnected} description="Contas ativas" />
        <Metric label="X conectado" value={xConnected} description="Contas ativas" />
        <Metric label="Aprovações pendentes" value={pendingApprovals?.length ?? 0} description="Revisar" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Alertas críticos">
          <EmptyState
            title="Sem alertas críticos"
            description="Nenhum alerta que exija ação imediata no momento."
          />
        </Card>

        <Card title="Contas aguardando lançamento">
          <EmptyState
            title="Nenhuma conta pendente"
            description="Todas as contas sociais estão em andamento ou conectadas."
          />
        </Card>

        <Card title="Conteúdo para aprovação hoje">
          <EmptyState
            title="Nada agendado"
            description="Nenhum conteúdo precisa de aprovação para hoje."
          />
        </Card>
      </div>
    </AmpliaLayout>
  );
}

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
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
