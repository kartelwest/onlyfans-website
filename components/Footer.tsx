import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** The number itself is a phone number, not copy — it is the same everywhere. */
const WHATSAPP_DISPLAY = "+1 (312) 470-2299";

export default function Footer() {
  const t = useTranslations("site.footer");

  return (
    <footer className="bg-[#2f1d25] px-6 pb-8 pt-16 text-white lg:px-12 lg:pt-20">
      <div className="mx-auto max-w-[1300px]">
        <div className="grid gap-12 border-b border-white/15 pb-14 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.9fr]">
          {/* ABOUT US */}
          <div>
            <Link href="/" className="inline-block">
              <Image
              src="/images/karray-logo.png"
              alt="KARAY Models"
              width={330}
              height={130}
              className="h-auto w-[230px] object-contain"
            />
            </Link>

            <h2 className="mt-7 font-serif text-3xl text-white">
              {t("aboutTitle")}
            </h2>

            <p className="mt-5 max-w-xl leading-8 text-white/70">
              {t("aboutBody")}
            </p>

            <p className="mt-4 max-w-xl leading-8 text-white/70">
              {t("aboutLimit")}
            </p>
          </div>

          {/* NAVIGATION */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#e9a5b8]">
              {t("navTitle")}
            </h3>

            <nav
              aria-label={t("navTitle")}
              className="mt-6 flex flex-col gap-4 text-white/70"
            >
              <Link
                href="/"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                {t("links.home")}
              </Link>

              <Link
                href="/por-que-nos"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                {t("links.whyUs")}
              </Link>

              <Link
                href="/faq"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                {t("links.faq")}
              </Link>

              <Link
                href="/aplicar"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                {t("links.apply")}
              </Link>

              <Link
                href="/login"
                className="transition hover:translate-x-1 hover:text-[#e9a5b8]"
              >
                {t("links.modelArea")}
              </Link>
            </nav>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#e9a5b8]">
              {t("contactTitle")}
            </h3>

            <div className="mt-6 space-y-8 text-white/70">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  {t("serviceTitle")}
                </p>

                <p className="mt-2 leading-7">
                  {t("serviceBody")}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  WhatsApp
                </p>

                <a
                  href="https://wa.me/13124702299"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 transition hover:text-[#e9a5b8]"
                  aria-label={t("whatsappAria")}
                >
                  {t("whatsappNumber", { number: WHATSAPP_DISPLAY })}
                </a>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  {t("whatsappPurpose")}
                </p>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  {t("whatsappResponse")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div className="flex flex-col gap-4 pt-8 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright")}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/privacidade"
              className="transition hover:text-[#e9a5b8]"
            >
              {t("links.privacy")}
            </Link>

            <Link
              href="/termos"
              className="transition hover:text-[#e9a5b8]"
            >
              {t("links.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
