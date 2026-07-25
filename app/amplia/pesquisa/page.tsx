import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaPesquisaPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Pesquisa">
      <EmptyState
        title="Nenhuma fonte de pesquisa"
        description="Fontes, tendências e achados de pesquisa serão gerenciados aqui."
      />
    </AmpliaLayout>
  );
}
