import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Stamps "last seen" on the account that just signed in.
 *
 * Both columns existed and neither was ever written: profiles.last_login_at is
 * new, and models.last_login_at has been rendered on three screens since the
 * first release while staying null forever. The write goes through the service
 * role because a session must not be able to update its own profile row.
 *
 * Called after a successful sign-in, and deliberately best-effort: a failure
 * here must never stand between somebody and their dashboard, so the route
 * answers 200 with `recorded: false` rather than an error the client would
 * have to handle.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ recorded: false }, { status: 401 });
  }

  const admin = createAdminClient();

  const now = new Date().toISOString();

  const { error: profileError } = await admin
    .from("profiles")
    .update({ last_login_at: now })
    .eq("id", user.id);

  // 42703 = the column is not on this database yet (the lifecycle migration
  // has not run). Nothing to do, and nothing worth failing over.
  if (profileError && profileError.code !== "42703") {
    console.error("Falha ao registrar o último acesso:", profileError);
  }

  const { error: modelError } = await admin
    .from("models")
    .update({ last_login_at: now })
    .eq("profile_id", user.id);

  if (modelError) {
    console.error(
      "Falha ao registrar o último acesso da modelo:",
      modelError,
    );
  }

  return NextResponse.json({ recorded: !profileError });
}
