import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.whyUsPage");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/** The revenue split figures are contract facts, not copy. */
const SPLIT_SHARES = ["60%", "20%", "20%"] as const;
const SPLIT_KEYS = ["model", "agency", "marketing"] as const;

function KarayHeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 30"
      aria-hidden="true"
      className={className}
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

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
        {eyebrow}
      </p>

      <h2 className="mt-5 font-serif text-4xl leading-[1.08] text-[#39272f] md:text-5xl">
        {title}
      </h2>

      {description && (
        <p className="mt-6 text-lg leading-8 text-[#75656c]">{description}</p>
      )}

      <div
        className={`mt-7 flex items-center gap-3 text-[#c65f7c] ${
          centered ? "justify-center" : ""
        }`}
      >
        <span className="h-px w-14 bg-[#d8a6b4]" />
        <KarayHeartIcon />
        <span className="h-px w-14 bg-[#d8a6b4]" />
      </div>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-4 rounded-2xl border border-[#ead8df] bg-white p-5"
        >
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6e3e9] text-[#b85f79]">
            <KarayHeartIcon className="h-4 w-4" />
          </span>

          <span className="leading-7 text-[#66565d]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A stack of body paragraphs read out of the catalog as a list. */
function Paragraphs({
  items,
  className = "",
  emphasise = [],
}: {
  items: string[];
  className?: string;
  emphasise?: number[];
}) {
  return (
    <>
      {items.map((text, index) => (
        <p
          key={text}
          className={emphasise.includes(index) ? `font-semibold ${className}` : className}
        >
          {text}
        </p>
      ))}
    </>
  );
}

export default function WhyUsPage() {
  const t = useTranslations("site.whyUsPage");

  const list = (key: string) => t.raw(key) as string[];

  return (
    <main className="overflow-hidden bg-[#fff9f5] text-[#39272f]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#412a34] px-6 pb-24 pt-44 text-white lg:px-12 lg:pb-32">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#c65f7c]/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-[#e9a5b8]/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1300px]">
          <div className="max-w-5xl">
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.34em] text-[#e9a5b8]">
              {t("hero.eyebrow")}
            </p>

            <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">
              {t("hero.title")}
            </h1>

            <p className="mt-8 max-w-4xl text-lg leading-8 text-white/75 md:text-xl">
              <span className="font-semibold text-[#f4c2d0]">
                {t("hero.highlight")}
              </span>{" "}
              {t("hero.body")}
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {(["models", "share", "management"] as const).map((key, index) => (
              <div key={key} className="border-l border-[#e9a5b8]/50 pl-6">
                <p className="font-serif text-5xl text-[#e9a5b8]">
                  {["30", "60%", "360°"][index]}
                </p>
                <p className="mt-3 text-sm uppercase tracking-[0.14em] text-white/70">
                  {t(`hero.stats.${key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INVESTIMOS EM VOCÊ */}
      <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b85f79]">
                {t("invest.eyebrow")}
              </p>

              <h2 className="mt-5 font-serif text-4xl leading-[1.08] text-[#39272f] md:text-5xl lg:text-6xl">
                {t("invest.title")}
              </h2>

              <p className="mt-7 text-lg leading-8 text-[#75656c]">
                {t("invest.body")}
              </p>

              <div className="mx-auto mt-7 flex items-center justify-center gap-3 text-[#c65f7c]">
                <span className="h-px w-16 bg-[#d8a6b4]" />

                <KarayHeartIcon className="h-5 w-5" />

                <span className="h-px w-16 bg-[#d8a6b4]" />
              </div>
            </div>

            <div className="mt-16 grid gap-7 md:grid-cols-2">
              {/* PROXY */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M12 3a9 9 0 1 0 9 9" />
                    <path d="M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 18.5 12 21" />
                    <path d="M12 3C9.5 5.5 8.3 8.5 8.3 12s1.2 6.5 3.7 9" />
                    <path d="M3.5 9h13M3.5 15h13" />
                    <path d="M18.5 4.5v5h-5" />
                    <path d="M20.5 3.5 13.5 10.5" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  {t("invest.cards.proxy.title")}
                </h3>

                <div className="mt-5 space-y-4 leading-8 text-[#75656c]">
                  <Paragraphs items={list("invest.cards.proxy.paragraphs")} />
                </div>
              </article>

              {/* NAVEGADOR */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M3 8h18" />
                    <path d="M7 6h.01M10 6h.01" />
                    <path d="m9 14 2 2 4-5" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  {t("invest.cards.browser.title")}
                </h3>

                <div className="mt-5 space-y-4 leading-8 text-[#75656c]">
                  <Paragraphs items={list("invest.cards.browser.paragraphs")} />
                </div>
              </article>

              {/* MARKETING */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M4 13V8l13-4v13L4 13Z" />
                    <path d="M7 14v5h4l-1-5" />
                    <path d="M19 8a3 3 0 0 1 0 5" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  {t("invest.cards.marketing.title")}
                </h3>

                <div className="mt-5 space-y-4 leading-8 text-[#75656c]">
                  <Paragraphs items={list("invest.cards.marketing.paragraphs")} />
                </div>
              </article>

              {/* GESTÃO */}
              <article className="rounded-[2rem] border border-[#ead8df] bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d8a6b4] md:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e5e8] text-[#b85f79]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M4 20V10h4v10H4Z" />
                    <path d="M10 20V4h4v16h-4Z" />
                    <path d="M16 20v-7h4v7h-4Z" />
                  </svg>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-[#39272f]">
                  {t("invest.cards.analytics.title")}
                </h3>

                <div className="mt-5 space-y-4 leading-8 text-[#75656c]">
                  <Paragraphs items={list("invest.cards.analytics.paragraphs")} />
                </div>
              </article>
            </div>

            <div className="mt-12 rounded-[2rem] bg-[#412a34] p-8 text-white md:p-10">
              <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#e9a5b8]">
                    {t("invest.banner.eyebrow")}
                  </p>

                  <h3 className="mt-5 font-serif text-3xl leading-tight md:text-4xl">
                    {t("invest.banner.title")}
                  </h3>

                  <p className="mt-6 leading-8 text-white/70">
                    {t("invest.banner.body")}
                  </p>
                </div>

                <ul className="grid gap-4 sm:grid-cols-2">
                  {list("invest.supportItems").map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                      <span className="mt-1 shrink-0 text-[#e9a5b8]">
                        <KarayHeartIcon className="h-5 w-5" />
                      </span>

                      <span className="leading-7 text-white/75">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 rounded-2xl bg-[#f4e5e8] p-7 text-center md:p-9">
              <p className="mx-auto max-w-4xl font-serif text-2xl leading-9 text-[#8f425a]">
                {t("invest.footnote")}
              </p>
            </div>
          </div>
        </section>

        {/* FAMÍLIA */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2">
            <SectionHeading
              eyebrow={t("family.eyebrow")}
              title={t("family.title")}
            />

            <div className="space-y-6 text-lg leading-8 text-[#66565d]">
              {list("family.paragraphs").map((text) => (
                <p key={text}>{text}</p>
              ))}

              <p className="font-semibold text-[#39272f]">
                {t("family.emphasis")}
              </p>

              <p className="font-semibold text-[#b85f79]">
                {t("family.closing")}
              </p>
            </div>
          </div>
        </section>

        {/* 30 MODELOS */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("thirty.eyebrow")}
              title={t("thirty.title")}
              description={t("thirty.description")}
              centered
            />

            <div className="mt-16 grid gap-7 lg:grid-cols-2">
              {(["one", "two"] as const).map((key) => (
                <article
                  key={key}
                  className="rounded-[2rem] border border-[#ead8df] bg-white p-8 md:p-10"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b85f79]">
                    {t(`thirty.reasons.${key}.label`)}
                  </p>

                  <h3 className="mt-5 font-serif text-3xl">
                    {t(`thirty.reasons.${key}.title`)}
                  </h3>

                  <div className="mt-7 space-y-5 leading-8 text-[#75656c]">
                    <Paragraphs
                      items={list(`thirty.reasons.${key}.paragraphs`)}
                      emphasise={[1]}
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[2rem] bg-[#412a34] px-8 py-10 text-center text-white md:px-14">
              <p className="mx-auto max-w-4xl font-serif text-2xl leading-9">
                {t("thirty.banner.body")}
              </p>

              <p className="mt-5 font-semibold text-[#e9a5b8]">
                {t("thirty.banner.closing")}
              </p>
            </div>
          </div>
        </section>

        {/* TRANSPARÊNCIA */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("transparency.eyebrow")}
              title={t("transparency.title")}
              description={t("transparency.description")}
            />

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {SPLIT_KEYS.map((key, index) => (
                <article
                  key={key}
                  className="rounded-[2rem] bg-[#412a34] p-8 text-white"
                >
                  <p className="font-serif text-5xl text-[#e9a5b8]">
                    {SPLIT_SHARES[index]}
                  </p>

                  <h3 className="mt-5 font-serif text-2xl">
                    {t(`transparency.split.${key}.title`)}
                  </h3>

                  <p className="mt-5 leading-7 text-white/70">
                    {t(`transparency.split.${key}.text`)}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-16 grid gap-10 lg:grid-cols-2">
              <div>
                <h3 className="font-serif text-3xl">
                  {t("transparency.agencyTitle")}
                </h3>

                <CheckList items={list("transparency.agencyItems")} />
              </div>

              <div>
                <h3 className="font-serif text-3xl">
                  {t("transparency.marketingTitle")}
                </h3>

                <CheckList items={list("transparency.marketingItems")} />
              </div>
            </div>
          </div>
        </section>

        {/* 3 PRIMEIROS MESES */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2">
            <SectionHeading
              eyebrow={t("firstMonths.eyebrow")}
              title={t("firstMonths.title")}
            />

            <div className="rounded-[2rem] border border-[#e5cad3] bg-white p-8 md:p-10">
              <div className="space-y-6 text-lg leading-8 text-[#75656c]">
                {list("firstMonths.paragraphs").map((text) => (
                  <p key={text}>{text}</p>
                ))}

                <p className="font-semibold text-[#b85f79]">
                  {t("firstMonths.closing")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CONTAS */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("accounts.eyebrow")}
              title={t("accounts.title")}
              description={t("accounts.description")}
            />

            <CheckList items={list("accounts.items")} />

            <p className="mt-10 max-w-4xl text-lg leading-8 text-[#75656c]">
              {t("accounts.footnote")}
            </p>
          </div>
        </section>

        {/* ACESSO E SEGURANÇA */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("access.eyebrow")}
              title={t("access.title")}
              description={t("access.description")}
            />

            <div className="mt-14 grid gap-7 lg:grid-cols-2">
              {(["security", "investment"] as const).map((key) => (
                <article
                  key={key}
                  className="rounded-[2rem] border border-[#ead8df] bg-white p-8 md:p-10"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b85f79]">
                    {t(`access.cards.${key}.label`)}
                  </p>

                  <h3 className="mt-5 font-serif text-3xl">
                    {t(`access.cards.${key}.title`)}
                  </h3>

                  <div className="mt-7 space-y-5 leading-8 text-[#75656c]">
                    <Paragraphs items={list(`access.cards.${key}.paragraphs`)} />
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-2xl bg-[#f4e5e8] p-8">
              <p className="text-lg leading-8 text-[#66565d]">
                {t("access.footnote")}
              </p>
            </div>
          </div>
        </section>

        {/* CONTAS EXISTENTES */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("existing.eyebrow")}
              title={t("existing.title")}
              description={t("existing.description")}
            />

            <p className="mt-8 max-w-4xl text-lg leading-8 text-[#75656c]">
              {t("existing.note")}
            </p>

            <CheckList items={list("existing.items")} />

            <p className="mt-10 max-w-4xl text-lg leading-8 text-[#75656c]">
              {t("existing.footnote")}
            </p>
          </div>
        </section>

        {/* LIBERDADE */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow={t("freedom.eyebrow")}
                title={t("freedom.title")}
              />

              <p className="mt-8 text-lg leading-8 text-[#75656c]">
                {t("freedom.body")}
              </p>
            </div>

            <div className="rounded-[2rem] bg-[#412a34] p-8 text-white md:p-10">
              <ul className="space-y-6">
                {list("freedom.items").map((item) => (
                  <li key={item} className="flex items-start gap-4">
                    <span className="mt-1 text-[#e9a5b8]">
                      <KarayHeartIcon className="h-5 w-5" />
                    </span>

                    <span className="leading-7 text-white/75">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CHATS */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("chats.eyebrow")}
              title={t("chats.title")}
              description={t("chats.description")}
            />

            <CheckList items={list("chats.items")} />
          </div>
        </section>

        {/* MARKETING */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("marketing.eyebrow")}
              title={t("marketing.title")}
              description={t("marketing.description")}
            />

            <CheckList items={list("marketing.items")} />

            <p className="mt-10 max-w-4xl text-lg leading-8 text-[#75656c]">
              {t("marketing.footnote")}
            </p>
          </div>
        </section>

        {/* INFRAESTRUTURA */}
        <section className="bg-[#f4e5e8] px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("infrastructure.eyebrow")}
              title={t("infrastructure.title")}
              description={t("infrastructure.description")}
            />

            <CheckList items={list("infrastructure.items")} />
          </div>
        </section>

        {/* CRESCIMENTO */}
        <section className="px-6 py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1300px]">
            <SectionHeading
              eyebrow={t("growth.eyebrow")}
              title={t("growth.title")}
              description={t("growth.description")}
            />

            <CheckList items={list("growth.items")} />

            <div className="mt-10 rounded-2xl bg-[#f4e5e8] p-8">
              <p className="font-serif text-2xl leading-9 text-[#8f425a]">
                {t("growth.footnote")}
              </p>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-[#412a34] px-6 py-28 text-white lg:px-12">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#e9a5b8]">
              {t("cta.eyebrow")}
            </p>

            <h2 className="mt-6 font-serif text-4xl leading-tight md:text-6xl">
              {t("cta.title")}
            </h2>

            <div className="mx-auto mt-8 max-w-4xl space-y-6 text-lg leading-8 text-white/75">
              {list("cta.paragraphs").map((text) => (
                <p key={text}>{text}</p>
              ))}

              <p className="font-semibold text-white">{t("cta.emphasis")}</p>

              <p className="font-semibold text-[#e9a5b8]">{t("cta.closing")}</p>
            </div>

            <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/aplicar"
                className="rounded-full bg-[#c65f7c] px-9 py-4 font-bold uppercase tracking-[0.1em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b]"
              >
                {t("cta.apply")}
              </a>

              <Link
                href="/"
                className="rounded-full border border-white/40 px-9 py-4 font-bold uppercase tracking-[0.1em] text-white transition hover:border-[#e9a5b8] hover:text-[#e9a5b8]"
              >
                {t("cta.home")}
              </Link>
            </div>
          </div>
        </section>
    </main>
  );
}
