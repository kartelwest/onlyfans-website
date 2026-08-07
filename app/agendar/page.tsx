import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import CalBooking from "@/components/CalBooking";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.booking");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function BookingPage() {
  const t = useTranslations("site.booking");

  return (
    <main className="overflow-hidden bg-[#fff9f5] text-[#39272f]">
      <section className="relative bg-[#412a34] px-6 pb-16 pt-40 text-white lg:px-12 lg:pb-20 lg:pt-48">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#c65f7c]/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#e9a5b8]/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1300px] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#e9a5b8]">
            {t("eyebrow")}
          </p>

          <h1 className="mt-4 font-serif text-4xl font-medium leading-tight md:text-5xl lg:text-6xl">
            {t("headline")}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/75">
            {t("body")}
          </p>
        </div>
      </section>

      <section className="px-6 py-12 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[1100px]">
          <CalBooking />
        </div>
      </section>
    </main>
  );
}
