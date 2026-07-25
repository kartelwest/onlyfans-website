import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaCalendarioPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Calendário">
      <EmptyState
        title="Calendário vazio"
        description="Aqui aparecerão os posts e reels agendados para Instagram e X."
      />
    </AmpliaLayout>
  );
}
