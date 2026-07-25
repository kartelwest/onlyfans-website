import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaPublicacoesPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Publicações">
      <EmptyState
        title="Nenhuma publicação"
        description="Aqui aparecerão as publicações enviadas, agendadas e falhas."
      />
    </AmpliaLayout>
  );
}
