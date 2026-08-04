"use server";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  isLocale,
} from "./config";

/**
 * Records a language choice.
 *
 * Two places, on purpose:
 *
 *   - The cookie is authoritative for the next render, and is what a signed-out
 *     visitor has. It is written first and unconditionally, so the switch works
 *     even if the database write fails.
 *   - `profiles.preferred_locale` is what carries the choice to the person's
 *     other devices. It goes through `set_preferred_locale()` because
 *     `profiles_update` is staff-only — see the migration for why that policy
 *     is not being widened.
 *
 * Deliberately returns nothing and redirects nowhere. The caller stays exactly
 * where it is and asks the router to re-render; a language switch that moved
 * you off the page you were reading would be a bug, not a feature.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    // A value that is not a locale is a programming error on the caller's side.
    // Ignoring it leaves the current language in place, which is the safe end
    // state for a preference toggle.
    return;
  }

  const cookieStore = await cookies();

  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Not httpOnly: this is a display preference, and keeping it readable lets
    // the client tell what the server decided without a second source of truth.
    httpOnly: false,
  });

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await supabase.rpc("set_preferred_locale", { p_locale: locale });
  } catch {
    // The cookie is already set, so the switch has visibly worked. A database
    // that is unreachable — or has not run the migration — costs the viewer
    // cross-device persistence, not the language they just picked.
  }
}
