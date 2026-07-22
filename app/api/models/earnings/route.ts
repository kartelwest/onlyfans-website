import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return NextResponse.json(
      { error: "Perfil inválido." },
      { status: 403 },
    );
  }

  const modelId =
    request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  // Verify model access based on role
  const supabaseForCheck = await createClient();
  let canAccess = false;

  if (profile.role === "owner" || profile.role === "administrator") {
    // Staff can access all models
    const { data: model } = await supabaseForCheck
      .from("models")
      .select("id")
      .eq("id", modelId)
      .maybeSingle();
    canAccess = !!model;
  } else if (profile.role === "representative") {
    // Rep can only access assigned models
    const { data: model } = await supabaseForCheck
      .from("models")
      .select("id")
      .eq("id", modelId)
      .eq("representative_id", user.id)
      .maybeSingle();
    canAccess = !!model;
  } else if (profile.role === "model") {
    // Model can only access own earnings where visible_to_model = true
    const { data: model } = await supabaseForCheck
      .from("models")
      .select("id")
      .eq("id", modelId)
      .eq("profile_id", user.id)
      .maybeSingle();
    canAccess = !!model;
  }

  if (!canAccess) {
    return NextResponse.json(
      { error: "Sem permissão." },
      { status: 403 },
    );
  }

  // Use request-scoped client for data access (RLS enforced)
  const { data, error } = await supabase
    .from("model_earnings_reports")
    .select("*")
    .eq("model_id", modelId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Erro ao carregar ganhos:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar ganhos." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return NextResponse.json(
      { error: "Perfil inválido." },
      { status: 403 },
    );
  }

  // Only owner and administrator can create earnings reports
  if (profile.role !== "owner" && profile.role !== "administrator") {
    return NextResponse.json(
      { error: "Sem permissão." },
      { status: 403 },
    );
  }

  const formData = await request.formData();

  const modelId = formData.get("modelId");
  const image = formData.get("image") as File | null;
  const platform = formData.get("platform");
  const period = formData.get("period");
  const grossRevenueStr = formData.get("grossRevenue");
  const reportDate = formData.get("reportDate");
  const visibleToModel = formData.get("visibleToModel");
  const adminNote = formData.get("adminNote");

  if (!modelId || typeof modelId !== "string") {
    return NextResponse.json(
      { error: "Identificação da modelo não informada." },
      { status: 400 },
    );
  }

  if (!image) {
    return NextResponse.json(
      { error: "Imagem obrigatória." },
      { status: 400 },
    );
  }

  // Validate gross revenue is a finite, non-negative number
  const grossRevenue = Number(grossRevenueStr);
  if (!isFinite(grossRevenue) || grossRevenue < 0) {
    return NextResponse.json(
      { error: "Valor da receita inválido." },
      { status: 400 },
    );
  }

  // Verify model exists
  const { data: model } = await supabase
    .from("models")
    .select("id")
    .eq("id", modelId)
    .maybeSingle();

  if (!model) {
    return NextResponse.json(
      { error: "Modelo não encontrada." },
      { status: 404 },
    );
  }

  // Get payment shares from model_payments or use defaults
  const { data: payment } = await supabase
    .from("model_payments")
    .select("model_percentage, agency_percentage, marketing_percentage")
    .eq("model_id", modelId)
    .maybeSingle();

  const modelPercentage = payment?.model_percentage ?? 60;
  const agencyPercentage = payment?.agency_percentage ?? 20;
  const marketingPercentage = payment?.marketing_percentage ?? 20;

  const modelShare = grossRevenue * (modelPercentage / 100);
  const agencyShare = grossRevenue * (agencyPercentage / 100);
  const marketingShare = grossRevenue * (marketingPercentage / 100);

  // Validate and sanitize file
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo 10MB." },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(image.type)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido." },
      { status: 400 },
    );
  }

  // Sanitize filename
  const safeFileName = image.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const fileName = `${crypto.randomUUID()}-${safeFileName}`;
  const path = `${modelId}/${fileName}`;

  const admin = createAdminClient();

  const upload = await admin.storage
    .from("model-earnings")
    .upload(path, image, {
      contentType: image.type,
      upsert: false,
    });

  if (upload.error) {
    console.error("Erro ao fazer upload:", upload.error);
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem." },
      { status: 500 },
    );
  }

  const insert = await admin
    .from("model_earnings_reports")
    .insert({
      model_id: modelId,
      platform: typeof platform === "string" ? platform : null,
      period: typeof period === "string" ? period : null,
      gross_revenue: grossRevenue,
      model_share: modelShare,
      agency_share: agencyShare,
      marketing_share: marketingShare,
      report_date: typeof reportDate === "string" ? reportDate : null,
      visible_to_model: visibleToModel === "true",
      admin_note: typeof adminNote === "string" ? adminNote : null,
      image_path: path,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insert.error) {
    // Rollback storage upload on DB error
    await admin.storage.from("model-earnings").remove([path]);
    console.error("Erro ao inserir relatório:", insert.error);
    return NextResponse.json(
      { error: "Erro ao salvar relatório." },
      { status: 500 },
    );
  }

  const signed = await admin.storage
    .from("model-earnings")
    .createSignedUrl(path, 3600);

  return NextResponse.json({
    report: {
      id: insert.data.id,
      modelId: insert.data.model_id,
      platform: insert.data.platform,
      period: insert.data.period,
      grossRevenue: insert.data.gross_revenue,
      modelShare: insert.data.model_share,
      agencyShare: insert.data.agency_share,
      marketingShare: insert.data.marketing_share,
      reportDate: insert.data.report_date,
      visibleToModel: insert.data.visible_to_model,
      adminNote: insert.data.admin_note,
      imagePath: insert.data.image_path,
      imageUrl: signed.data?.signedUrl ?? null,
      createdAt: insert.data.created_at,
      updatedAt: insert.data.updated_at,
    },
  });
}