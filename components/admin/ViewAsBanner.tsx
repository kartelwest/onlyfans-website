import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * Which screen of this model is on display right now. The banner keeps all
 * three one tap apart, because that is how a support call goes: her screen
 * first, so you see what she is describing, then ours.
 */
export type ViewAsScreen = "model" | "representative";

export type ViewAsSwitcher = {
  modelId: string;
  /** Null only if the row somehow has no slug — the admin link is dropped. */
  modelSlug: string | null;
  current: ViewAsScreen;
};

export default function ViewAsBanner({
  label,
  backHref,
  switcher,
}: {
  label: string;
  backHref: string;
  switcher?: ViewAsSwitcher;
}) {
  const t = useTranslations("admin.viewAs.banner");

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#4b2438] px-6 py-3 text-white shadow-md">
      <p className="text-sm font-semibold">
        {t("mode", { label })}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {switcher && (
          <>
            <SwitcherLink
              href={`/admin/view-as/model/${switcher.modelId}`}
              active={switcher.current === "model"}
            >
              {t("modelScreen")}
            </SwitcherLink>

            <SwitcherLink
              href={`/admin/view-as/model/${switcher.modelId}/representative`}
              active={switcher.current === "representative"}
            >
              {t("representativeScreen")}
            </SwitcherLink>

            {switcher.modelSlug && (
              <SwitcherLink
                href={`/admin/models/${switcher.modelSlug}`}
                active={false}
              >
                {t("adminPanel")}
              </SwitcherLink>
            )}
          </>
        )}

        <Link
          href={backHref}
          className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/20"
        >
          {t("backToPanel")}
        </Link>
      </div>
    </div>
  );
}

function SwitcherLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
        active
          ? "bg-white text-[#4b2438]"
          : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </Link>
  );
}
