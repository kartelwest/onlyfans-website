import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.privacy");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function PrivacidadePage() {
  const t = useTranslations("site.privacy");

  return (
    <main className="min-h-screen bg-[#fff9f5] px-6 py-24 text-[#39272f] lg:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
          KARAY Models
        </p>

        <h1 className="mt-4 font-serif text-4xl font-bold lg:text-5xl">
          {t("title")}
        </h1>

        <p className="mt-6 leading-7 text-[#5f5056]">{t("body")}</p>

        <p className="mt-4 leading-7 text-[#5f5056]">{t("contact")}</p>
      </div>
    </main>
  );
}
