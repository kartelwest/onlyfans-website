"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { exitViewAsRepresentative } from "@/app/admin/representatives/actions";

type ViewAsRepresentativeBannerProps = {
  label: string;
  backHref: string;
  representativeId: string;
};

export default function ViewAsRepresentativeBanner({
  label,
  backHref,
  representativeId,
}: ViewAsRepresentativeBannerProps) {
  const t = useTranslations("admin.viewAs");
  const [isPending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      await exitViewAsRepresentative(representativeId, backHref);
    });
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#4b2438] px-6 py-3 text-white shadow-md">
      <p className="text-sm font-semibold">
        {t("bannerRepresentative", { label })}
      </p>

      <button
        type="button"
        onClick={handleExit}
        disabled={isPending}
        className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/20 disabled:opacity-50"
      >
        {isPending ? t("exiting") : t("exit")}
      </button>
    </div>
  );
}
