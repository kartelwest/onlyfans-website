import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateUser } from "@/lib/api/auth";
import { mapEarningsReport } from "@/lib/models/earnings";

export async function GET(request: NextRequest) {
  const auth = await authenticateUser({
    unauthenticated: "Unauthorized",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const modelId =
    request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "modelId is required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("model_earnings_reports")
    .select("*")
    .eq("model_id", modelId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const reports = await Promise.all(
    (data ?? []).map(async (report) => {
      let imageUrl: string | null = null;

      if (report.image_path) {
        const signed =
          await admin.storage
            .from("model-earnings")
            .createSignedUrl(
              report.image_path,
              60 * 60,
            );

        if (!signed.error) {
          imageUrl = signed.data.signedUrl;
        }
      }

      return mapEarningsReport(report, imageUrl);
    }),
  );

  return NextResponse.json({
    reports,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateUser({
    unauthenticated: "Unauthorized",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const { user } = auth;

  const admin = createAdminClient();

  const formData =
    await request.formData();

  const image =
    formData.get("image") as File | null;

  if (!image) {
    return NextResponse.json(
      { error: "Image required." },
      { status: 400 },
    );
  }

  const fileName = `${crypto.randomUUID()}-${image.name}`;

  const path = `${formData.get(
    "modelId",
  )}/${fileName}`;

  const upload =
    await admin.storage
      .from("model-earnings")
      .upload(path, image, {
        upsert: false,
      });

  if (upload.error) {
    return NextResponse.json(
      {
        error:
          upload.error.message,
      },
      { status: 500 },
    );
  }

  const gross = Number(
    formData.get("grossRevenue"),
  );

  const modelShare =
    gross * 0.6;

  const agencyShare =
    gross * 0.2;

  const marketingShare =
    gross * 0.2;

  const insert =
    await admin
      .from(
        "model_earnings_reports",
      )
      .insert({
        model_id:
          formData.get("modelId"),
        platform:
          formData.get("platform"),
        period:
          formData.get("period"),
        gross_revenue:
          gross,
        model_share:
          modelShare,
        agency_share:
          agencyShare,
        marketing_share:
          marketingShare,
        report_date:
          formData.get(
            "reportDate",
          ),
        visible_to_model:
          formData.get(
            "visibleToModel",
          ) === "true",
        admin_note:
          formData.get(
            "adminNote",
          ),
        image_path: path,
        uploaded_by: user.id,
      })
      .select()
      .single();

  if (insert.error) {
    return NextResponse.json(
      {
        error:
          insert.error.message,
      },
      { status: 500 },
    );
  }

  const signed =
    await admin.storage
      .from("model-earnings")
      .createSignedUrl(
        path,
        3600,
      );

  return NextResponse.json({
    report: mapEarningsReport(
      insert.data,
      signed.data?.signedUrl ?? null,
    ),
  });
}