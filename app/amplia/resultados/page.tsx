import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaResultadosPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Resultados">
      <EmptyState
        title="Sem dados"
        description="As métricas e análises de contas conectadas aparecerão aqui."
      />
    </AmpliaLayout>
  );
}
