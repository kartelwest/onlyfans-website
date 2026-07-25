import { requireAmpliaAccess } from "@/lib/amplia/auth";
import NovoClienteForm from "@/components/amplia/NovoClienteForm";

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  await requireAmpliaAccess();
  return <NovoClienteForm />;
}
