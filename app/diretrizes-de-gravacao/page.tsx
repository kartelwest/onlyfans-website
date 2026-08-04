import { useTranslations } from "next-intl";

type GuidelineSection = {
  title: string;
  items: string[];
};

export default function DiretrizesDeGravacaoPage() {
  const t = useTranslations("site.recordingGuidelines");

  const guidelines = t.raw("sections") as GuidelineSection[];

  return (
    <main className="min-h-screen bg-[#0b0a0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#e8b84b]">
          KARAY MODELS
        </p>

        <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>

        <p className="mt-3 text-sm leading-6 text-white/60">{t("intro")}</p>

        <div className="mt-8 space-y-6">
          {guidelines.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-[#161219] p-5"
            >
              <h2 className="text-lg font-bold text-[#e8b84b]">
                {section.title}
              </h2>

              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-6 text-white/75"
                  >
                    <span aria-hidden="true" className="text-[#e8b84b]">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
