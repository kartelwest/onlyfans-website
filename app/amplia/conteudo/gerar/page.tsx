import { requireAmpliaAccess } from "@/lib/amplia/auth";
import GerarConteudoForm from "@/components/amplia/GerarConteudoForm";

export const dynamic = "force-dynamic";

export default async function GerarConteudoPage() {
  await requireAmpliaAccess();
  return <GerarConteudoForm />;
}
