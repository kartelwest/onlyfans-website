import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function AuditoriaPage() {
  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Histórico de alterações em perfis de marca, consentimentos, aprovações e configurações do Amplia."
      />

      <EmptyState
        title="Nenhum registro de auditoria exibido ainda"
        description="brand_profile_versions e client_consents já registram histórico no banco desde a Fase 1 — esta tela para navegá-los chega em uma fase posterior, junto com audit_logs consolidado."
        note="Dados já auditados no banco; painel de leitura em fase posterior"
      />
    </div>
  );
}
