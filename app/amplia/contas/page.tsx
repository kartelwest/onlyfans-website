import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaContasPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Contas Sociais">
      <EmptyState
        title="Nenhuma conta conectada"
        description="As contas sociais aparecerão aqui após o lançamento e conexão OAuth."
      />
    </AmpliaLayout>
  );
}
