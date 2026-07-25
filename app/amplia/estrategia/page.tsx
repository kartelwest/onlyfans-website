import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaEstrategiaPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Estratégia">
      <EmptyState
        title="Estratégia em construção"
        description="Aqui ficarão os pilares de conteúdo, objetivos e experimentos de cada cliente."
      />
    </AmpliaLayout>
  );
}
