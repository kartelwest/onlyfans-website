import { useTranslations } from "next-intl";

/**
 * The numerals are ordinals in a design, not prose — "01" is "01" in both
 * languages. Only the title and body come from the catalog.
 */
const reasons = ["invest", "onlyThirty", "partnership", "transparency", "management", "growth"] as const;

/** The revenue split. Percentages are facts about the contract, not copy. */
const split = [
  { share: "60%", key: "model" },
  { share: "20%", key: "agency" },
  { share: "20%", key: "marketing" },
] as const;

export default function AgencyDifference() {
  const t = useTranslations("site.difference");

  return (
    <section className="overflow-hidden bg-[#f2e4df] px-6 py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
              {t("eyebrow")}
            </p>

            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.08] text-[#3c2730] md:text-5xl lg:text-6xl">
              {t("headline")}
            </h2>

            <p className="mt-7 max-w-lg text-base leading-8 text-[#6e5c63]">
              {t("body")}
            </p>

            <a
              href="/por-que-nos"
              className="mt-9 inline-flex rounded-full bg-[#a94f69] px-8 py-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition duration-300 hover:-translate-y-1 hover:bg-[#8f3f57]"
            >
              {t("cta")}
            </a>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {reasons.map((key, index) => (
              <article
                key={key}
                className="group rounded-[1.75rem] border border-[#d8bfc7] bg-[#fffaf7] p-7 shadow-[0_18px_50px_rgba(89,54,67,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(89,54,67,0.12)] md:p-8"
              >
                <div className="flex items-start justify-between gap-5">
                  <p className="font-serif text-4xl text-[#d8a6b4]">
                    {String(index + 1).padStart(2, "0")}
                  </p>

                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8a6b4] text-[#b85f79] transition group-hover:bg-[#b85f79] group-hover:text-white"
                  >
                    ↗
                  </span>
                </div>

                <h3 className="mt-10 font-serif text-2xl text-[#3c2730]">
                  {t(`reasons.${key}.title`)}
                </h3>

                <p className="mt-4 text-sm leading-7 text-[#6e5c63]">
                  {t(`reasons.${key}.description`)}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 overflow-hidden rounded-[2rem] bg-[#482a35] text-white">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
            <div className="border-b border-white/10 p-8 md:p-12 lg:border-b-0 lg:border-r">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#e0a7b7]">
                {t("split.eyebrow")}
              </p>

              <h3 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">
                {t("split.headline")}
              </h3>

              <p className="mt-6 max-w-lg leading-8 text-white/70">
                {t("split.body")}
              </p>
            </div>

            <div className="grid sm:grid-cols-3">
              {split.map((entry, index) => (
                <div
                  key={entry.key}
                  className={
                    index === split.length - 1
                      ? "p-8 md:p-10"
                      : "border-b border-white/10 p-8 sm:border-b-0 sm:border-r md:p-10"
                  }
                >
                  <p className="font-serif text-5xl text-[#efb1c2]">
                    {entry.share}
                  </p>

                  <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em]">
                    {t(`split.parties.${entry.key}.label`)}
                  </p>

                  <p className="mt-3 text-sm leading-6 text-white/65">
                    {t(`split.parties.${entry.key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
