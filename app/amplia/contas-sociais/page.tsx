import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function ContasSociaisPage() {
  return (
    <div>
      <PageHeader
        title="Contas Sociais"
        description="Instagram (Graph API oficial) e X (playbook manual, API inativa)."
      />

      <EmptyState
        title="Nenhuma conta social conectada"
        description="O Account Launch Center e a conexão OAuth com Instagram chegam na Fase 2/4. Contas nunca são criadas por automação — sempre por um humano seguindo o pacote de lançamento gerado pela IA."
        note="Fase 2 — Account Launch Center"
      />
    </div>
  );
}
