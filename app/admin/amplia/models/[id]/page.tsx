import { notFound } from "next/navigation";
import { requireAdminAmpliaAccess } from "@/lib/amplia/admin";
import { getAmpliaClientById } from "@/lib/amplia/clients";
import AmpliaDetailClient from "@/components/amplia/AmpliaDetailClient";

export const dynamic = "force-dynamic";

type AmpliaDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAmpliaDetailPage({
  params,
}: AmpliaDetailPageProps) {
  await requireAdminAmpliaAccess();

  const { id } = await params;

  const { client, error } = await getAmpliaClientById(id);

  if (error || !client) {
    notFound();
  }

  return <AmpliaDetailClient client={client} />;
}
