import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { resetDailyChecklists } from "@/lib/daily/reset";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Nightly Vercel cron (see vercel.json), scheduled at 03:00 UTC — midnight in
// São Paulo, which is where the working day is measured. It clears yesterday's
// ticks and notes so the team opens a fresh list, and writes an automatic
// "NÃO FOI TRABALHADO" note against any active model whose list was untouched.
//
// Idempotent per model (models.daily_reset_on), so a missed or retried run
// finishes the day rather than wiping a second one.
export async function GET(request: NextRequest) {
  const tRoute = await getTranslations("errors.cron");
  const secret = process.env.CRON_SECRET;

  // Vercel sends `Authorization: Bearer $CRON_SECRET`. Without a configured
  // secret the endpoint stays closed rather than open.
  if (!secret) {
    console.error(
      "CRON_SECRET não configurado — cron do checklist diário bloqueado.",
    );

    return NextResponse.json(
      { error: tRoute("notConfigured") },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: tRoute("unauthorized") }, { status: 401 });
  }

  try {
    const result = await resetDailyChecklists(createAdminClient());

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Erro ao reiniciar os checklists diários:", error);

    return NextResponse.json(
      { error: tRoute("failed") },
      { status: 500 },
    );
  }
}
