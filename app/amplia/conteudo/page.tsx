import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function ConteudoPage() {
  return (
    <div>
      <PageHeader
        title="Conteúdo"
        description="Content Studio: pilares, geração assistida por IA, banco de mídia e aprovações, para Instagram e X."
      />

      <EmptyState
        title="Nenhum conteúdo gerado"
        description="O Content Studio chega na Fase 3. A geração de conteúdo do X funciona mesmo com a API do X desativada — apenas a publicação automática depende da flag."
        note="Fase 3 — Content Studio"
      />
    </div>
  );
}
