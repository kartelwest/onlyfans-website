import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaAuditoriaPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout title="Auditoria">
      <EmptyState
        title="Nenhum evento"
        description="Logs de auditoria de alterações, publicações e acessos aparecerão aqui."
      />
    </AmpliaLayout>
  );
}
