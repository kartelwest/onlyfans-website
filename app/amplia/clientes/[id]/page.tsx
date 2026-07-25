import { notFound } from "next/navigation";
import { AmpliaLayout, Card, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";
import { getTalentWithBrandProfile } from "@/lib/brand/talent";
import { getClientConsents } from "@/lib/brand/consent";
import { getClientBoundaries } from "@/lib/brand/boundaries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AmpliaClienteDetailPage({ params }: PageProps) {
  await requireAmpliaAccess();
  const { id } = await params;

  const { talent, brandProfile, error } = await getTalentWithBrandProfile(id);
  if (error || !talent) {
    notFound();
  }

  const consents = await getClientConsents(id);
  const boundaries = await getClientBoundaries(id);

  return (
    <AmpliaLayout title={talent.displayName || talent.stageName || "Cliente"}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Identidade">
          <dl className="space-y-2 text-sm">
            <Info label="Nome artístico" value={talent.stageName} />
            <Info label="Exibição" value={talent.displayName} />
            <Info label="Username preferido" value={talent.preferredUsername} />
            <Info label="E-mail" value={talent.email} />
            <Info label="WhatsApp" value={talent.whatsapp} />
            <Info label="Local" value={talent.location} />
            <Info label="Nacionalidade" value={talent.nationality} />
          </dl>
        </Card>

        <Card title="Marca">
          {brandProfile ? (
            <dl className="space-y-2 text-sm">
              <Info label="Status" value={brandProfile.brandStatus} />
              <Info label="Categoria" value={brandProfile.brandCategory} />
              <Info label="Nichos" value={`${brandProfile.niche1}${brandProfile.niche2 ? `, ${brandProfile.niche2}` : ""}${brandProfile.niche3 ? `, ${brandProfile.niche3}` : ""}`} />
              <Info label="Posicionamento" value={`${brandProfile.primaryPositioning ?? ""}${brandProfile.secondaryPositioning ? ` / ${brandProfile.secondaryPositioning}` : ""}`} />
              <Info label="Diretriz de IA" value={brandProfile.aiGuidance} />
              <Info label="Modo Instagram" value={brandProfile.instagramAutomationMode} />
              <Info label="Modo X" value={brandProfile.xAutomationMode} />
            </dl>
          ) : (
            <EmptyState title="Sem perfil de marca" description="O perfil de marca ainda não foi criado." />
          )}
        </Card>

        <Card title="Consentimentos">
          {consents.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {consents.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span className="text-white/70">{c.consentKey}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      c.granted ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                    }`}
                  >
                    {c.granted ? "Sim" : "Não"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sem consentimentos" description="Nenhum consentimento registrado." />
          )}
        </Card>
      </div>

      {boundaries && (
        <div className="mt-6">
          <Card title="Limites e segurança">
            <div className="grid gap-4 sm:grid-cols-2 text-sm text-white/70">
              <p>Palavras proibidas: {boundaries.prohibitedWords.join(", ") || "—"}</p>
              <p>Assuntos proibidos: {boundaries.prohibitedSubjects.join(", ") || "—"}</p>
              <p>Contas a não mencionar: {boundaries.accountsNotToMention.join(", ") || "—"}</p>
              <p>Detalhes privados: {boundaries.privateDetailsNeverReveal.join(", ") || "—"}</p>
              <p>Tópicos de crise: {boundaries.crisisTopics.join(", ") || "—"}</p>
              <p>Bloquear nudez: {boundaries.neverGenerateNudity ? "Sim" : "Não"}</p>
            </div>
          </Card>
        </div>
      )}
    </AmpliaLayout>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
      <span className="text-white/80">{value ?? "—"}</span>
    </div>
  );
}
