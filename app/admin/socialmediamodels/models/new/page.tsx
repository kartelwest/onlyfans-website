import { getTranslations } from "next-intl/server";
import { requireAdminAmpliaAccess } from "@/lib/amplia/admin";
import NovoClienteForm from "@/components/amplia/NovoClienteForm";

export const dynamic = "force-dynamic";

export default async function AdminSocialMediaNewClientPage() {
  const t = await getTranslations("admin.ampliaClients");

  await requireAdminAmpliaAccess();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
          PORTAL DA AMPLIA
        </p>
        <h1 className="mt-2 text-3xl font-bold">{t("newClientTitle")}</h1>
        <p className="mt-2 text-sm text-white/55">
          {t("newClientIntro")}
        </p>

        <div className="mt-8">
          <NovoClienteForm />
        </div>
      </div>
    </main>
  );
}
