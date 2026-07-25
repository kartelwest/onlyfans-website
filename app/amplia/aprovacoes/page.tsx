import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaAprovacoesPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Aprovações">
      <EmptyState
        title="Nada pendente"
        description="Conteúdos aguardando aprovação do cliente ou da agência aparecerão aqui."
      />
    </AmpliaLayout>
  );
}
