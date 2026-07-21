import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const { reportId } = await context.params;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } =
    await admin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.active ||
    !["owner", "administrator"].includes(
      profile.role,
    )
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const { data: report, error: reportError } =
    await admin
      .from("model_earnings_reports")
      .select("id, image_path")
      .eq("id", reportId)
      .maybeSingle();

  if (reportError) {
    return NextResponse.json(
      { error: reportError.message },
      { status: 500 },
    );
  }

  if (!report) {
    return NextResponse.json(
      { error: "Report not found." },
      { status: 404 },
    );
  }

  if (report.image_path) {
    const { error: storageError } =
      await admin.storage
        .from("model-earnings")
        .remove([report.image_path]);

    if (storageError) {
      return NextResponse.json(
        { error: storageError.message },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await admin
    .from("model_earnings_reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
  });
}