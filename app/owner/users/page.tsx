import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import LogoutButton from "@/components/LogoutButton";
import OwnerUserSection, {
  OwnerUserSectionSkeleton,
} from "@/components/admin/OwnerUserSection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OwnerUsersPage() {
  const t = await getTranslations("owner.usersPage");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ownerProfile, error: ownerError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    ownerError ||
    !ownerProfile ||
    !ownerProfile.active ||
    ownerProfile.role !== "owner"
  ) {
    redirect("/admin/models");
  }

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white lg:px-8">
      <section className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">
              {t("portal")}
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {t("title")}
            </h1>

            <p className="mt-2 text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/models"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-400 hover:text-pink-300"
            >
              {t("backToModels")}
            </Link>

            <LogoutButton />
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/owner/users/new?role=model"
            className="rounded-xl border border-pink-400/30 bg-[#161116] p-5 text-sm font-semibold text-pink-200 transition hover:border-pink-400 hover:bg-pink-400/10"
          >
            {t("addModel")}
          </Link>

          <Link
            href="/owner/users/new?role=administrator"
            className="rounded-xl border border-pink-400/30 bg-[#161116] p-5 text-sm font-semibold text-pink-200 transition hover:border-pink-400 hover:bg-pink-400/10"
          >
            {t("addAdministrator")}
          </Link>

          <Link
            href="/owner/users/new?role=representative"
            className="rounded-xl border border-pink-400/30 bg-[#161116] p-5 text-sm font-semibold text-pink-200 transition hover:border-pink-400 hover:bg-pink-400/10"
          >
            {t("addRepresentative")}
          </Link>
        </div>

        <div className="space-y-6">
          <Suspense
            fallback={<OwnerUserSectionSkeleton title={t("models")} />}
          >
            <OwnerUserSection
              title={t("models")}
              role="model"
              emptyMessage={t("noModels")}
              limit={10}
              viewAllHref="/admin/models"
              viewAllLabel={t("viewAll")}
            />
          </Suspense>

          <Suspense
            fallback={
              <OwnerUserSectionSkeleton title={t("representatives")} />
            }
          >
            <OwnerUserSection
              title={t("representatives")}
              role="representative"
              emptyMessage={t("noRepresentatives")}
            />
          </Suspense>

          <Suspense
            fallback={
              <OwnerUserSectionSkeleton title={t("administrators")} />
            }
          >
            <OwnerUserSection
              title={t("administrators")}
              role="administrator"
              emptyMessage={t("noAdministrators")}
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}