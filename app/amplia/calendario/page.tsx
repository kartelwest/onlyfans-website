import EmptyState from "@/components/amplia/EmptyState";
import PageHeader from "@/components/amplia/PageHeader";

export default function CalendarioPage() {
  return (
    <div>
      <PageHeader
        title="Calendário"
        description="Calendário unificado de posts, reels e stories do Instagram e posts/threads do X (playbook manual)."
      />

      <EmptyState
        title="Nenhum item agendado"
        description="O calendário de conteúdo chega na Fase 3, junto com o Content Studio."
        note="Fase 3 — Content Studio"
      />
    </div>
  );
}
