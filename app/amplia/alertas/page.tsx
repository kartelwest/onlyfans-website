import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function AlertasPage() {
  return (
    <div>
      <PageHeader
        title="Alertas"
        description="Autorização expirando, falha de publicação, conta restrita, conteúdo pendente, consentimento vencido e outros eventos que exigem atenção humana."
      />

      <EmptyState
        title="Nenhum alerta"
        description="O motor de alertas é construído junto com cada integração — os primeiros alertas reais chegam na Fase 4 (Instagram)."
        note="A partir da Fase 4"
      />
    </div>
  );
}
