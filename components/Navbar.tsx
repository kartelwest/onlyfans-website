"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import LocaleSwitcher from "@/components/LocaleSwitcher";

function KarayHeartIcon() {
  return (
    <svg
      viewBox="0 0 32 30"
      aria-hidden="true"
      className="h-4 w-4"
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

/**
 * `key` names a translation, not a label. AMPLIA stays out of the catalog on
 * purpose — it is the name of a product, and a product's name is the same in
 * every language.
 */
const menuLinks = [
  { key: "home", href: "/" },
  { key: "whyUs", href: "/por-que-nos" },
  { key: "faq", href: "/faq" },
  { key: "booking", href: "/agendar" },
  { key: "login", href: "/login" },
  { key: "amplia", href: "/admin/socialmediamodels" },
] as const;

export default function Navbar() {
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="absolute left-0 top-0 z-50 w-full">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-16">
          <Link href="/" className="relative z-50 flex items-center">
            <Image
              src="/images/karray-logo.png"
              alt="KARAY Models"
              width={360}
              height={140}
              priority
              className="h-auto w-[210px] object-contain sm:w-[240px] lg:w-[250px] xl:w-[320px]"
            />
          </Link>

          {/* DESKTOP MENU */}
          <nav
            aria-label={t("primary")}
            className="hidden items-center gap-5 text-sm font-semibold uppercase tracking-[0.14em] text-white lg:flex xl:gap-8 xl:text-base"
          >
            {menuLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="group relative py-3 transition duration-300 hover:-translate-y-1 hover:text-[#e9a5b8]"
              >
                {t(link.key)}

                <span className="absolute left-1/2 top-full -translate-x-1/2 scale-0 text-[#e9a5b8] opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100">
                  <KarayHeartIcon />
                </span>
              </Link>
            ))}
          </nav>

          {/*
            The switcher sits outside the hamburger on purpose. Most of this
            audience is on a phone, and a language control you can only reach by
            first opening a menu written in a language you cannot read is not
            really reachable.
          */}
          <div className="relative z-50 flex items-center gap-3">
            <LocaleSwitcher variant="public" />

            {/* DESKTOP BUTTON */}
            <Link
              href="/aplicar"
              className="hidden whitespace-nowrap rounded-full bg-[#c95f7d] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white transition duration-300 hover:-translate-y-1 hover:bg-[#ae4e69] lg:inline-flex xl:px-8 xl:py-4 xl:text-sm"
            >
              {t("apply")}
            </Link>

            {/* MOBILE HAMBURGER BUTTON */}
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-[#412a34]/75 text-white backdrop-blur-md lg:hidden"
            >
              <span className="sr-only">
                {menuOpen ? t("closeMenu") : t("openMenu")}
              </span>

              <div className="flex w-6 flex-col gap-[5px]">
                <span
                  className={`h-[2px] w-full bg-white transition duration-300 ${
                    menuOpen ? "translate-y-[7px] rotate-45" : ""
                  }`}
                />

                <span
                  className={`h-[2px] w-full bg-white transition duration-300 ${
                    menuOpen ? "opacity-0" : ""
                  }`}
                />

                <span
                  className={`h-[2px] w-full bg-white transition duration-300 ${
                    menuOpen ? "-translate-y-[7px] -rotate-45" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        <div
          className={`fixed inset-0 z-40 bg-[#2f1d25]/98 px-6 pt-32 text-white backdrop-blur-xl transition duration-300 lg:hidden ${
            menuOpen
              ? "visible translate-x-0 opacity-100"
              : "invisible translate-x-full opacity-0"
          }`}
        >
          <nav
            aria-label={t("mobile")}
            className="flex flex-col items-center gap-3"
          >
            {menuLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="group flex w-full max-w-sm items-center justify-between border-b border-white/15 px-3 py-5 font-serif text-3xl transition hover:text-[#e9a5b8]"
              >
                <span>{t(link.key)}</span>

                <span className="text-[#e9a5b8]">
                  <KarayHeartIcon />
                </span>
              </Link>
            ))}

            <Link
              href="/aplicar"
              onClick={() => setMenuOpen(false)}
              className="mt-8 w-full max-w-sm rounded-full bg-[#c95f7d] px-8 py-5 text-center text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#ae4e69]"
            >
              {t("apply")}
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
