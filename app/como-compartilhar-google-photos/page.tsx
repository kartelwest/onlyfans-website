import { useTranslations } from "next-intl";

type Step = {
  number: string;
  title: string;
  text: string;
};

function PhoneIllustration({
  type,
}: {
  type: "iphone" | "android";
}) {
  const t = useTranslations("site.googlePhotos");

  return (
    <div className="mx-auto flex h-[310px] w-[170px] items-center justify-center rounded-[2.2rem] border-[7px] border-[#3a252e] bg-white p-3 shadow-sm">
      <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] bg-[#f8e9ed]">
        <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-[#3a252e]" />

        <div className="px-4 pt-10">
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-[#9d4861]">
            Google Photos
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-16 rounded-lg bg-[#deb5c1]" />
            <div className="h-16 rounded-lg bg-[#c9879a]" />
            <div className="h-12 rounded-lg bg-[#ebd0d7]" />
            <div className="h-12 rounded-lg bg-[#b85f79]" />
          </div>

          <div className="mt-5 rounded-xl bg-white p-3">
            <p className="text-center text-[10px] font-semibold text-[#66565d]">
              Compartilhar álbum
            </p>

            <div className="mx-auto mt-3 h-8 w-20 rounded-full bg-[#c65f7c]" />
          </div>

          <p className="mt-4 text-center text-[10px] text-[#75656c]">
            {type === "iphone" ? t("exampleIphone") : t("exampleAndroid")}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[#ead8df] bg-white p-6">
      <div className="flex items-start gap-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4e5e8] font-serif text-lg text-[#b85f79]">
          {number}
        </span>

        <div>
          <h3 className="font-serif text-2xl text-[#39272f]">{title}</h3>

          <p className="mt-3 leading-7 text-[#75656c]">{text}</p>
        </div>
      </div>
    </article>
  );
}

export default function GooglePhotosInstructionsPage() {
  const t = useTranslations("site.googlePhotos");

  const iphoneSteps = t.raw("iphoneSteps") as Step[];
  const androidSteps = t.raw("androidSteps") as Step[];

  return (
    <main className="bg-[#fff9f5] text-[#39272f]">
      <section className="bg-[#412a34] px-6 pb-20 pt-56 text-white lg:px-12 lg:pt-64">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#e9a5b8]">
            {t("eyebrow")}
          </p>

          <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">
            {t("title")}
          </h1>

          <p className="mt-7 max-w-3xl text-lg leading-8 text-white/75">
            {t("intro")}
          </p>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="rounded-[2rem] border border-[#e5cad3] bg-[#f4e5e8] p-7 md:p-9">
            <h2 className="font-serif text-3xl">{t("beforeYouStart")}</h2>

            <ul className="mt-6 space-y-3 leading-7 text-[#66565d]">
              {(t.raw("checklist") as string[]).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <section className="mt-20">
            <div className="grid gap-12 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b85f79]">
                  {t("appleIphone")}
                </p>

                <h2 className="mt-4 font-serif text-4xl">
                  {t("iphoneTitle")}
                </h2>

                <div className="mt-8">
                  <PhoneIllustration type="iphone" />
                </div>
              </div>

              <div className="grid gap-4">
                {iphoneSteps.map((step) => (
                  <StepCard key={step.number} {...step} />
                ))}
              </div>
            </div>
          </section>

          <section className="mt-24 border-t border-[#ead8df] pt-20">
            <div className="grid gap-12 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b85f79]">
                  {t("androidPhones")}
                </p>

                <h2 className="mt-4 font-serif text-4xl">
                  {t("androidTitle")}
                </h2>

                <div className="mt-8">
                  <PhoneIllustration type="android" />
                </div>
              </div>

              <div className="grid gap-4">
                {androidSteps.map((step) => (
                  <StepCard key={step.number} {...step} />
                ))}
              </div>
            </div>
          </section>

          <section className="mt-20 rounded-[2rem] bg-[#412a34] p-8 text-white md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e9a5b8]">
                  {t("finalCheck")}
                </p>

                <h2 className="mt-4 font-serif text-3xl md:text-4xl">
                  {t("testLink")}
                </h2>

                <p className="mt-5 max-w-3xl leading-8 text-white/70">
                  {t("testLinkBody")}
                </p>
              </div>

              <a
                href="/aplicar"
                className="rounded-full bg-[#c65f7c] px-8 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:-translate-y-1 hover:bg-[#ae4f6b]"
              >
                {t("backToApplication")}
              </a>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}