"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import { setLocale } from "@/lib/i18n/actions";
import {
  LOCALES,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  type Locale,
  toLocale,
} from "@/lib/i18n/config";

/**
 * The one language switcher, used by both the public header and the back
 * office. There is deliberately not a second one: the two headers look nothing
 * alike, but the behaviour — write the cookie, persist to the profile, re-render
 * where you already are — has to be identical, and the surest way to keep it
 * identical is to have one copy of it.
 *
 * `variant` only changes colour. On the public site the header floats over the
 * hero photograph; in the admin the bar is near-black. Both are dark, so the
 * difference is small, but the admin's is a solid surface and can carry a
 * heavier border.
 */
export default function LocaleSwitcher({
  variant = "public",
  className = "",
}: {
  variant?: "public" | "admin";
  className?: string;
}) {
  const t = useTranslations("common.localeSwitcher");
  const active = toLocale(useLocale());
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback((refocus = false) => {
    setOpen(false);

    if (refocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // A dropdown that survives a click on the page behind it is a dropdown that
  // gets left open on a phone, where there is no cursor to move away.
  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Focus moves into the list when it opens, so a keyboard user is where the
  // arrow keys are useful without having to press Tab first.
  useEffect(() => {
    if (open) {
      const index = LOCALES.indexOf(active);
      optionRefs.current[index === -1 ? 0 : index]?.focus();
    }
  }, [open, active]);

  function choose(next: Locale) {
    close(true);

    if (next === active) {
      return;
    }

    startTransition(async () => {
      await setLocale(next);

      // Re-renders every server component for the route we are already on. No
      // push, no replace: the URL does not carry the locale, so the address bar
      // has nothing to say about this and the reader stays on their page.
      router.refresh();
    });
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onOptionKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + delta + LOCALES.length) % LOCALES.length;

      optionRefs.current[next]?.focus();
      return;
    }

    if (event.key === "Tab") {
      close();
    }
  }

  const surface =
    variant === "admin"
      ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      : "border-white/40 bg-[#412a34]/60 text-white backdrop-blur-md hover:bg-[#412a34]/80";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        disabled={pending}
        aria-label={t("ariaLabel", { language: LOCALE_LABELS[active] })}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 ${surface}`}
      >
        <Flag locale={active} />

        <span className="hidden sm:inline">{LOCALE_LABELS[active]}</span>

        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={`h-2 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("listLabel")}
          className="absolute right-0 z-[60] mt-2 min-w-[11rem] overflow-hidden rounded-2xl border border-white/15 bg-[#1a1116] py-1 shadow-2xl shadow-black/40"
        >
          {LOCALES.map((locale, index) => {
            const selected = locale === active;

            return (
              <li key={locale} role="option" aria-selected={selected}>
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  tabIndex={-1}
                  onClick={() => choose(locale)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:bg-white/15 ${
                    selected
                      ? "bg-white/10 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Flag locale={locale} />

                  <span className="flex-1">{LOCALE_LABELS[locale]}</span>

                  {selected && (
                    <svg
                      viewBox="0 0 14 14"
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-pink-300"
                    >
                      <path
                        d="M2 7.5L5.5 11L12 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The border is not decoration. The US flag's top and bottom stripes are white,
 * so without an edge the rectangle bleeds into any light surface and the flag
 * appears to be missing a slice.
 */
function Flag({ locale }: { locale: Locale }) {
  return (
    <Image
      src={LOCALE_FLAGS[locale]}
      alt=""
      aria-hidden="true"
      width={23}
      height={16}
      unoptimized
      className="h-4 w-auto shrink-0 rounded-[2px] border border-black/20 ring-1 ring-white/25"
    />
  );
}
