import { getRequestConfig } from "next-intl/server";

import { TIME_ZONE, isLocale } from "@/lib/i18n/config";
import { resolveLocale } from "@/lib/i18n/resolveLocale";

/**
 * next-intl's per-request configuration, in "without i18n routing" mode.
 *
 * There is no `[locale]` route segment in this app and there must not be one —
 * the URLs are already public and linked from elsewhere. So `requestLocale`,
 * which normally carries the matched segment, is always undefined here and the
 * locale comes from the cookie/profile resolver instead.
 *
 * This runs before any component renders, which is the whole point: the server
 * emits HTML that is already in the right language, so there is nothing for the
 * client to correct and no hydration mismatch to warn about.
 */
export default getRequestConfig(async ({ locale }) => {
  // An explicit override — `getTranslations({locale: 'en-US'})` — wins, which
  // is what lets a background job render a message in a language other than the
  // current viewer's.
  const active = isLocale(locale) ? locale : await resolveLocale();

  return {
    locale: active,

    messages: (await import(`../messages/${active}.json`)).default,

    // Pinned rather than inferred: see the note in lib/i18n/config.ts.
    timeZone: TIME_ZONE,

    formats: {
      dateTime: {
        /** 09/03/2026 in pt-BR, 03/09/2026 in en-US. */
        short: {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
        /** Same, plus 24h clock — the format the audit trail reads in. */
        dateTime: {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
        /** "9 de março de 2026" / "March 9, 2026". */
        long: {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
        /** "março de 2026" / "March 2026" — the earnings month headings. */
        monthYear: {
          month: "long",
          year: "numeric",
        },
      },

      number: {
        /** 1.234,56 in pt-BR, 1,234.56 in en-US. */
        decimal: {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
        integer: {
          maximumFractionDigits: 0,
        },
        percent: {
          style: "percent",
          maximumFractionDigits: 2,
        },
      },
    },
  };
});
