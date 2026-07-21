import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireManagerProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
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
    !["owner", "administrator"].includes(profile.role)
  ) {
    return {
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      ),
    };
  }

  return { user, admin };
}

export async function GET(request: NextRequest) {
  const auth = await requireManagerProfile();

  if ("response" in auth) {
    return auth.response;
  }

  const { admin } = auth;

  const modelId =
    request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "modelId is required." },
      { status: 400 },
    );
  }

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

      return {
        id: report.id,
        modelId: report.model_id,
        platform: report.platform,
        period: report.period,
        grossRevenue:
          report.gross_revenue,
        modelShare:
          report.model_share,
        agencyShare:
          report.agency_share,
        marketingShare:
          report.marketing_share,
        reportDate:
          report.report_date,
        visibleToModel:
          report.visible_to_model,
        adminNote:
          report.admin_note,
        imagePath:
          report.image_path,
        imageUrl,
        createdAt:
          report.created_at,
        updatedAt:
          report.updated_at,
      };
    }),
  );

  return NextResponse.json({
    reports,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireManagerProfile();

  if ("response" in auth) {
    return auth.response;
  }

  const { user, admin } = auth;

  const formData =
    await request.formData();

  const modelId = formData.get("modelId");

  if (typeof modelId !== "string" || !modelId.trim()) {
    return NextResponse.json(
      { error: "modelId is required." },
      { status: 400 },
    );
  }

  const image =
    formData.get("image") as File | null;

  if (!image) {
    return NextResponse.json(
      { error: "Image required." },
      { status: 400 },
    );
  }

  const fileName = `${crypto.randomUUID()}-${image.name}`;

  const path = `${modelId}/${fileName}`;

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

  if (!Number.isFinite(gross) || gross < 0) {
    return NextResponse.json(
      { error: "grossRevenue must be a valid number." },
      { status: 400 },
    );
  }

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
          modelId,
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
    report: {
      id: insert.data.id,
      modelId:
        insert.data.model_id,
      platform:
        insert.data.platform,
      period:
        insert.data.period,
      grossRevenue:
        insert.data
          .gross_revenue,
      modelShare:
        insert.data
          .model_share,
      agencyShare:
        insert.data
          .agency_share,
      marketingShare:
        insert.data
          .marketing_share,
      reportDate:
        insert.data
          .report_date,
      visibleToModel:
        insert.data
          .visible_to_model,
      adminNote:
        insert.data
          .admin_note,
      imagePath:
        insert.data.image_path,
      imageUrl:
        signed.data
          ?.signedUrl ?? null,
      createdAt:
        insert.data
          .created_at,
      updatedAt:
        insert.data
          .updated_at,
    },
  });
}