"use client";

import Image from "next/image";
import { useState } from "react";

function KarrayHeartIcon() {
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

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="h-7 w-7"
      fill="currentColor"
    >
      <path d="M16.04 3C8.85 3 3 8.73 3 15.78c0 2.25.6 4.45 1.73 6.38L3 29l7.03-1.8a13.16 13.16 0 0 0 6 1.45h.01C23.23 28.65 29 22.92 29 15.86 29 8.8 23.23 3 16.04 3Zm0 23.49h-.01a10.95 10.95 0 0 1-5.57-1.5l-.4-.24-4.17 1.07 1.11-4-.26-.41a10.52 10.52 0 0 1-1.63-5.63c0-5.86 4.9-10.63 10.94-10.63 6.02 0 10.82 4.82 10.82 10.71 0 5.86-4.84 10.63-10.83 10.63Zm5.99-7.96c-.33-.16-1.95-.94-2.25-1.05-.3-.11-.52-.16-.74.16-.22.32-.85 1.05-1.04 1.27-.19.21-.38.24-.71.08-.33-.16-1.39-.5-2.65-1.6a9.85 9.85 0 0 1-1.83-2.22c-.19-.32-.02-.5.14-.66.15-.15.33-.37.49-.56.16-.18.22-.32.33-.53.11-.21.05-.4-.03-.56-.08-.16-.74-1.75-1.01-2.4-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.4-.3.32-1.14 1.1-1.14 2.67s1.17 3.09 1.33 3.3c.16.21 2.3 3.44 5.57 4.82.78.33 1.39.53 1.87.68.78.24 1.49.21 2.05.13.63-.09 1.95-.78 2.22-1.54.27-.77.27-1.43.19-1.57-.08-.13-.3-.21-.63-.37Z" />
    </svg>
  );
}

const menuLinks = [
  { name: "Início", href: "/" },
  { name: "Por Que Nós", href: "/por-que-nos" },
  { name: "FAQ", href: "/faq" },
  { name: "Área da Modelo", href: "/modelo/raissa" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="absolute left-0 top-0 z-50 w-full">
      <div className="mx-auto flex max-w-[1440px] items-start justify-between px-5 py-5 sm:px-8 lg:items-center lg:px-16">
        <a href="/" className="relative z-50 flex items-center">
          <Image
            src="/images/karray-logo.png"
            alt="KARAY Models"
            width={360}
            height={140}
            priority
            className="h-auto w-[210px] object-contain sm:w-[240px] lg:w-[320px]"
          />
        </a>

        {/* DESKTOP MENU */}
        <nav className="hidden items-center gap-9 text-base font-semibold uppercase tracking-[0.14em] text-white lg:flex">
          {menuLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="group relative py-3 transition duration-300 hover:-translate-y-1 hover:text-[#e9a5b8]"
            >
              {link.name}

              <span className="absolute left-1/2 top-full -translate-x-1/2 scale-0 text-[#e9a5b8] opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100">
                <KarrayHeartIcon />
              </span>
            </a>
          ))}
        </nav>

        {/* DESKTOP BUTTON */}
        <a
          href="/aplicar"
          className="hidden rounded-full bg-[#c95f7d] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white transition duration-300 hover:-translate-y-1 hover:bg-[#ae4e69] lg:inline-flex"
        >
          Candidate-se
        </a>

        {/* MOBILE BUTTONS */}
        <div className="relative z-50 flex flex-col items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-[#412a34]/75 text-white backdrop-blur-md"
          >
            <span className="sr-only">
              {menuOpen ? "Fechar menu" : "Abrir menu"}
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

          <a
            href="https://wa.me/5521970715503"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar conosco pelo WhatsApp"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition duration-300 hover:scale-110 hover:bg-[#1ebe5d]"
          >
            <WhatsAppIcon />
          </a>
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
        <nav className="flex flex-col items-center gap-3">
          {menuLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="group flex w-full max-w-sm items-center justify-between border-b border-white/15 px-3 py-5 font-serif text-3xl transition hover:text-[#e9a5b8]"
            >
              <span>{link.name}</span>

              <span className="text-[#e9a5b8]">
                <KarrayHeartIcon />
              </span>
            </a>
          ))}

          <a
            href="/aplicar"
            onClick={() => setMenuOpen(false)}
            className="mt-8 w-full max-w-sm rounded-full bg-[#c95f7d] px-8 py-5 text-center text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#ae4e69]"
          >
            Candidate-se
          </a>
        </nav>
      </div>
    </header>
  );
}