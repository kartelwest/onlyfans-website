import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function AprovacoesPage() {
  return (
    <div>
      <PageHeader
        title="Aprovações"
        description="Fila de aprovação de conteúdo e mudanças de perfil de marca, por proprietário, administrador, gerente de marca ou cliente."
      />

      <EmptyState
        title="Nenhuma aprovação pendente"
        description="A fila de aprovações chega na Fase 3, junto com a geração de conteúdo que ela revisa."
        note="Fase 3 — Content Studio"
      />
    </div>
  );
}
