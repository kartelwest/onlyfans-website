import Link from "next/link";
import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaConteudoPage() {
  await requireAmpliaAccess();
  return (
    <AmpliaLayout
      title="Conteúdo"
      actions={
        <Link
          href="/amplia/conteudo/gerar"
          className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-200 transition hover:bg-pink-500/20"
        >
          + Gerar conteúdo
        </Link>
      }
    >
      <EmptyState
        title="Nenhum conteúdo gerado"
        description="Use o botão acima para criar o primeiro conteúdo com IA."
      />
    </AmpliaLayout>
  );
}
