import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * The figures stay in code and the captions come from the catalog: "30" and
 * "24/7" read the same in both languages, and a number kept in step across two
 * JSON files is a number that will eventually disagree with itself.
 */
const stats = [
  { value: "30", key: "activeModels" },
  { value: "100%", key: "attention" },
  { value: "24/7", key: "support" },
] as const;

export default function Hero() {
  const t = useTranslations("site.hero");

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1f1b1d]">
      <Image
        src="/images/hero.jpeg"
        alt={t("imageAlt")}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[62%_center]"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-[#1d1b1d]/95 via-[#1d1b1d]/68 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1440px] items-center px-6 pb-36 pt-40 md:px-10 lg:px-16">
        <div className="max-w-[680px] text-white">
          <p className="mb-6 mt-12 text-sm font-semibold uppercase tracking-[0.24em] text-[#e7a5b7] sm:text-base lg:mt-16">
            {t("eyebrow")}
          </p>

          <h1 className="font-serif text-4xl font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-[64px]">
            {t("headline")}
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-white/80 sm:text-lg">
            <span className="font-semibold text-[#f4c2d0]">
              {t("highlight")}
            </span>
            <br />
            <br />
            {t("body")}
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/aplicar"
              className="rounded-full bg-[#c95f7d] px-8 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#ae4e69]"
            >
              {t("ctaPrimary")}
            </Link>

            <Link
              href="/agendar"
              className="rounded-full border border-white/70 bg-white/5 px-8 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm transition duration-300 hover:bg-white hover:text-[#3f2631]"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-20 w-full">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
          <div className="grid max-w-[760px] overflow-hidden bg-[#43252f]/94 text-white shadow-2xl backdrop-blur-md sm:grid-cols-3">
            {stats.map((stat, index) => (
              <div
                key={stat.value}
                className={`px-7 py-7 ${index !== stats.length - 1
                    ? "border-b border-white/15 sm:border-b-0 sm:border-r"
                    : ""
                  }`}
              >
                <p className="font-serif text-4xl leading-none text-white">
                  {stat.value}
                </p>

                <p className="mt-3 max-w-[175px] text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-white/75">
                  {t(`stats.${stat.key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
