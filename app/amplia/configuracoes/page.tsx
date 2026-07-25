import { AmpliaLayout, Card } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaConfiguracoesPage() {
  const { role } = await requireAmpliaAccess();

  return (
    <AmpliaLayout title="Configurações">
      <Card title="Funcionalidades">
        <div className="space-y-3 text-sm text-white/70">
          <p>X / Twitter API: <span className="font-bold text-red-300">OFF</span> (feature flag)</p>
          <p>Instagram publicação automática: requer App Review Meta.</p>
          <p>Papel atual: <span className="text-pink-300">{role}</span></p>
        </div>
      </Card>
    </AmpliaLayout>
  );
}
