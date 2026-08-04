import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * The 404. Rendered inside the root layout, so it already sits under the
 * locale provider and reads in whatever language the visitor chose — a wrong
 * address is exactly the moment not to also switch language on somebody.
 */
export default function NotFound() {
  const t = useTranslations("errors.notFound");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f1ec] px-6 py-20 text-center">
      <p className="font-serif text-7xl text-[#d8a6b4]">404</p>

      <h1 className="mt-6 text-3xl font-bold text-[#4b2438]">{t("title")}</h1>

      <p className="mt-4 max-w-md text-sm leading-7 text-[#765c68]">
        {t("description")}
      </p>

      <Link
        href="/"
        className="mt-9 rounded-full bg-[#4b2438] px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#321725]"
      >
        {t("action")}
      </Link>
    </main>
  );
}
