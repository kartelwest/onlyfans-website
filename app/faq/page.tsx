import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

/**
 * The FAQ body is a tree — categories, questions, and a list of paragraphs per
 * answer — so it is read out of the catalog wholesale with `t.raw` rather than
 * being flattened into a hundred numbered keys. `i18n:check` still walks it
 * leaf by leaf, so a paragraph missing from one locale is still a failed build.
 */
type FaqGroup = {
  category: string;
  questions: Array<{
    question: string;
    answer: string[];
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.faq");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

function KarayHeartIcon() {
  return (
    <svg
      viewBox="0 0 32 30"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
    >
      <path
        d="M16 27L5.2 16.5C1.4 12.8 1.4 6.9 5.2 3.5C8.7.3 14 .9 16 5.1C18 .9 23.3.3 26.8 3.5C30.6 6.9 30.6 12.8 26.8 16.5L16 27Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M7.2 17.8L2.8 27.2M24.8 17.8L29.2 27.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function FAQPage() {
  const t = useTranslations("site.faq");

  const faqGroups = t.raw("groups") as FaqGroup[];

  return (
    <main className="overflow-hidden bg-[#fff9f5] text-[#39272f]">
      <section className="relative bg-[#412a34] px-6 pb-16 pt-64 text-white lg:px-12 lg:pb-20 lg:pt-72">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#c65f7c]/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#e9a5b8]/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1300px]">
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#e9a5b8]">
            {t("eyebrow")}
          </p>

          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">
            {t("title")}
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75 md:text-xl">
            {t("intro")}
          </p>

          <div className="mt-7 max-w-4xl rounded-[1.5rem] border border-[#e9a5b8]/30 bg-white/10 p-5 backdrop-blur-md md:p-6">
            <p className="font-serif text-2xl leading-8 text-white md:text-3xl">
              {t("highlightTitle")}
            </p>

            <p className="mt-3 leading-7 text-white/70">
              {t("highlightBody")}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-[1100px]">
          {faqGroups.map((group, groupIndex) => (
            <div
              key={group.category}
              className={groupIndex === 0 ? "" : "mt-12"}
            >
              <div className="flex items-center gap-4">
                <span className="text-[#c65f7c]">
                  <KarayHeartIcon />
                </span>

                <h2 className="font-serif text-3xl md:text-4xl">
                  {group.category}
                </h2>
              </div>

              <div className="mt-5 space-y-3">
                {group.questions.map((item) => (
                  <details
                    key={item.question}
                    className="group overflow-hidden rounded-[1.25rem] border border-[#ead8df] bg-white"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 font-serif text-xl leading-7 marker:content-none md:px-7 md:py-5 md:text-2xl">
                      <span>{item.question}</span>

                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4e5e8] font-sans text-2xl font-light text-[#b85f79] transition duration-300 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>

                    <div className="border-t border-[#f0e2e7] px-5 py-5 text-base leading-7 text-[#6f6066] md:px-7 md:py-6">
                      <div className="space-y-4">
                        {item.answer.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f4e5e8] px-6 py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
            {t("stillHaveQuestions")}
          </p>

          <h2 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">
            {t("ctaHeadline")}
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#75656c]">
            {t("ctaBody")}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/aplicar"
              className="rounded-full bg-[#c65f7c] px-9 py-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b]"
            >
              {t("ctaApply")}
            </a>

            <a
              href="/login"
              className="rounded-full border border-[#b85f79] px-9 py-4 text-sm font-bold uppercase tracking-[0.1em] text-[#9d4861] transition hover:bg-[#b85f79] hover:text-white"
            >
              {t("ctaContact")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
