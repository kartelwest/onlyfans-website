import AmpliaSettingsForm from "@/components/amplia/AmpliaSettingsForm";
import PageHeader from "@/components/amplia/PageHeader";
import { requireAmpliaAccess } from "@/lib/amplia/auth";
import { getAmpliaConfig } from "@/lib/amplia/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await requireAmpliaAccess();
  const supabase = await createClient();
  const config = await getAmpliaConfig(supabase);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Nome do módulo, flag do X e (em fases futuras) provedores de IA, orçamento e regras de automação."
      />

      <div className="max-w-xl rounded-2xl border border-white/10 bg-[#111115] p-6">
        <AmpliaSettingsForm
          config={config}
          canEdit={session.role === "owner"}
        />
      </div>
    </div>
  );
}
