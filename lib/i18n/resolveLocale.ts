import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  isLocale,
  toLocale,
} from "./config";

/**
 * Resolves the locale for the current request, server-side, before anything
 * renders. The order is fixed by product decision:
 *
 *   1. `profiles.preferred_locale`, when the viewer is signed in and has one.
 *      This is what makes the choice follow a person onto a second device.
 *   2. The `NEXT_LOCALE` cookie, which covers signed-out visitors and is also
 *      what the switcher writes first so the very next render is already right.
 *   3. pt-BR.
 *
 * `Accept-Language` is deliberately NOT consulted. A Brazilian agency's site
 * defaults to Portuguese even for a browser that asks for English.
 *
 * Called once per request through next-intl's request config, which memoises
 * its result — so the profile lookup below happens at most once per render.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  const profileLocale = await readProfileLocale();

  if (profileLocale) {
    return profileLocale;
  }

  return toLocale(cookieLocale);
}

/**
 * The signed-in viewer's stored preference, or null.
 *
 * Every failure mode here — no session, no profile, a database that has not run
 * the `preferred_locale` migration yet — collapses to null, because a language
 * lookup must never be the thing that takes a page down. The caller then falls
 * through to the cookie.
 */
async function readProfileLocale(): Promise<Locale | null> {
  const cookieStore = await cookies();

  // `supabase.auth.getUser()` is a network call to the auth server. Skipping it
  // when the request carries no Supabase session cookie keeps anonymous traffic
  // on the public marketing pages from paying for a lookup that cannot succeed.
  const hasSessionCookie = cookieStore
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );

  if (!hasSessionCookie) {
    return null;
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("preferred_locale")
      .eq("id", user.id)
      .maybeSingle();

    // 42703 (undefined_column) is the expected shape on a database that has not
    // run the migration yet. Treated like any other miss.
    if (error || !data) {
      return null;
    }

    return isLocale(data.preferred_locale) ? data.preferred_locale : null;
  } catch {
    return null;
  }
}

export { DEFAULT_LOCALE };
