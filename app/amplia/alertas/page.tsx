import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaAlertasPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Alertas">
      <EmptyState
        title="Sem alertas"
        description="Alertas de autorização, publicação, estoque e anomalias aparecerão aqui."
      />
    </AmpliaLayout>
  );
}
