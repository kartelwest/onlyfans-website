import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function PesquisaPage() {
  return (
    <div>
      <PageHeader
        title="Pesquisa"
        description="Achados de fontes oficiais e legítimas: políticas de plataforma, tendências, padrões de concorrência e desempenho próprio."
      />

      <EmptyState
        title="Nenhum achado de pesquisa"
        description="O pipeline de pesquisa automatizada chega na Fase 6."
        note="Fase 6 — Pesquisa e Otimização"
      />
    </div>
  );
}
