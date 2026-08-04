import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE,
} from "@/lib/auth/inactivityConfig";

export const dynamic = "force-dynamic";

export async function POST() {
  const t = await getTranslations("errors.api");
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: t("notAuthenticated") },
        { status: 401 },
      );
    }

    const now = Date.now();
    const cookieStore = await cookies();
    cookieStore.set(LAST_ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.ceil(INACTIVITY_TIMEOUT_MS / 1000),
    });

    return NextResponse.json({
      success: true,
      timestamp: now,
      timeoutMs: INACTIVITY_TIMEOUT_MS,
    });
  } catch {
    return NextResponse.json(
      { error: t("internal") },
      { status: 500 },
    );
  }
}
