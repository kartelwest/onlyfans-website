import { NextRequest, NextResponse } from "next/server";

import { snapshotDueLedgerEntries } from "@/lib/ledger/snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Daily Vercel cron (see vercel.json): freezes the BRL->USD rate on every
// ledger entry whose deduction date has arrived. The same routine also runs
// lazily whenever the earnings card or the admin ledger is read, so a missed
// run only delays the snapshot, it never skips one.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Vercel sends `Authorization: Bearer $CRON_SECRET`. Without a configured
  // secret the endpoint stays closed rather than open.
  if (!secret) {
    console.error("CRON_SECRET não configurado — cron de descontos bloqueado.");

    return NextResponse.json(
      { error: "Cron não configurado." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await snapshotDueLedgerEntries(createAdminClient());

  return NextResponse.json({ success: true, ...result });
}
