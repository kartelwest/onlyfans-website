"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import LogoutButton from "@/components/LogoutButton";
import type { ManagementRole } from "@/types/model";

/**
 * The admin portal's navigation.
 *
 * Every tab here is a real destination. The old "Dashboard" tab pointed at
 * `/admin`, which has no page of its own and answered 404 — it is gone, and
 * Pageview took its place. `/admin/representatives` had no link at all, which
 * is why it existed but could not be reached.
 *
 * `role` comes from the server layout, which reads it from the database. It
 * only decides what is DRAWN: every page behind these links re-checks the
 * viewer's role server-side, so a hidden link is a convenience, never the
 * protection.
 */

type NavItem = {
  href: string;
  /** A key under the `admin.nav` namespace, not a label. */
  key: string;
  /** Roles allowed to see the link. Omitted means every staff role. */
  roles?: ManagementRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/models", key: "models" },
  { href: "/admin/representatives", key: "representatives" },
  { href: "/admin/pageview", key: "pageview" },
  { href: "/admin/socialmediamodels", key: "amplia" },
];

const STAFF_ROLES: ManagementRole[] = ["owner", "administrator"];

export default function AdminHeader({
  role,
}: {
  /** Null when the viewer has no profile — the pages then redirect anyway. */
  role?: ManagementRole | null;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  // A view-as page is meant to be the other person's screen, exactly. Our own
  // chrome on top of it is the one thing that is certainly not on hers — and
  // the view banner already carries the way back.
  if (pathname?.startsWith("/admin/view-as")) {
    return null;
  }

  const portalKey = getPortalKey(pathname);

  const isStaff = Boolean(role && STAFF_ROLES.includes(role));

  const visibleItems = isStaff
    ? NAV_ITEMS.filter(
        (item) => !item.roles || (role && item.roles.includes(role)),
      )
    : [];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0d]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
            {t(`portals.${portalKey}.title`)}
          </p>

          <p className="mt-1 text-sm text-white/50">
            {t(`portals.${portalKey}.subtitle`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {visibleItems.length > 0 && (
            <nav
              aria-label={t("nav.ariaLabel")}
              className="flex flex-wrap items-center gap-2"
            >
              {visibleItems.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "border-pink-400/60 bg-pink-500/20 text-pink-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
            </nav>
          )}

          {/*
            Sits with the user controls, at the end of the bar, so it lands in
            the same place on every admin screen. On a phone the header stacks
            and this row wraps — the switcher stays on screen either way.
          */}
          <LocaleSwitcher variant="admin" />

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

/**
 * A tab is active on its own page and on everything nested under it, so
 * `/admin/representatives/<id>` still highlights "Representantes". The guard on
 * the next character keeps `/admin/modelsomething` from matching `/admin/models`.
 */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Which entry under `admin.portals` titles this section of the back office. */
function getPortalKey(pathname: string | null): string {
  if (pathname?.startsWith("/admin/socialmediamodels")) {
    return "amplia";
  }

  if (pathname?.startsWith("/admin/models")) {
    return "models";
  }

  if (pathname?.startsWith("/admin/representatives")) {
    return "representatives";
  }

  if (pathname?.startsWith("/admin/pageview")) {
    return "pageview";
  }

  return "crm";
}
