import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function PublicacoesPage() {
  return (
    <div>
      <PageHeader
        title="Publicações"
        description="Histórico e status de publicação via API oficial do Instagram (falhas, retentativas, motivos de bloqueio)."
      />

      <EmptyState
        title="Nenhuma publicação registrada"
        description="A publicação automatizada via Instagram Graph API chega na Fase 4 e depende de App Review da Meta aprovado."
        note="Fase 4 — Integração com Instagram"
      />
    </div>
  );
}
