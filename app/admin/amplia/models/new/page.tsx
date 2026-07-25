import { requireAdminAmpliaAccess } from "@/lib/amplia/admin";
import NovoClienteForm from "@/components/amplia/NovoClienteForm";

export const dynamic = "force-dynamic";

export default async function AdminAmpliaNewClientPage() {
  await requireAdminAmpliaAccess();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="text-3xl font-bold">Novo cliente Brand Growth</h1>
        <p className="mt-2 text-sm text-white/55">
          Criar um cliente Amplia sem vinculação ao /admin/models.
        </p>

        <div className="mt-8">
          <NovoClienteForm />
        </div>
      </div>
    </main>
  );
}
