"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * The 500. Error boundaries have to be Client Components, and this one sits
 * under the root layout's provider, so it is translated like everything else.
 *
 * Next 16.2 passes `unstable_retry`, which re-fetches and re-renders the
 * boundary's children — that is what "try again" should do here. `reset()`
 * only clears the error state without re-fetching, which would usually just
 * reproduce the same failure.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors.serverError");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f1ec] px-6 py-20 text-center">
      <p className="font-serif text-7xl text-[#d8a6b4]">500</p>

      <h1 className="mt-6 text-3xl font-bold text-[#4b2438]">{t("title")}</h1>

      <p className="mt-4 max-w-md text-sm leading-7 text-[#765c68]">
        {t("description")}
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full bg-[#4b2438] px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#321725]"
        >
          {t("action")}
        </button>

        <Link
          href="/"
          className="rounded-full border border-[#4b2438]/30 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#4b2438] transition hover:bg-[#4b2438]/5"
        >
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
