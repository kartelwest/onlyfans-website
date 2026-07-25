import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function ResultadosPage() {
  return (
    <div>
      <PageHeader
        title="Resultados"
        description="Métricas de conta, conteúdo, estratégia e agência — sempre com dados reais, estimados e previstos claramente separados."
      />

      <EmptyState
        title="Nenhum dado de resultado ainda"
        description="Analytics chegam junto com a integração do Instagram (Fase 4) e a entrada manual de métricas do X (Fase 5, Layer 2)."
        note="Fases 4 e 5"
      />
    </div>
  );
}
