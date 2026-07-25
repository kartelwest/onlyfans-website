import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function EstrategiaPage() {
  return (
    <div>
      <PageHeader
        title="Estratégia"
        description="Missão, posicionamento, personas de audiência, pilares e experimentos de crescimento, gerados e versionados pela IA a partir do perfil de marca."
      />

      <EmptyState
        title="Nenhuma estratégia gerada"
        description="O estrategista de marca por IA chega na Fase 6, após o perfil de marca (niches, guidance, boundaries) estar completo para pelo menos um cliente."
        note="Fase 6 — Pesquisa e Otimização"
      />
    </div>
  );
}
