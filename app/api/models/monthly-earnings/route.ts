import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAuditEntry } from "@/lib/audit/auditLogger";
import { requireModelAccess, requireStaff } from "@/lib/api/requireRole";
import { toPeriodMonth } from "@/lib/earnings/period";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// The manual monthly earnings figure — there is no OnlyFans API. The admin
// types the gross USD for a calendar month and attaches the screenshot it came
// from. Screenshots live in the private `model-earnings` bucket and are only
// ever handed out as short-lived signed URLs from this owner/administrator-only
// endpoint: a rep or a model never receives one.

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type EarningsRow = {
  id: string;
  model_id: string;
  period_month: string;
  gross_revenue: number | string;
  model_share: number | string;
  visible_to_model: boolean;
  image_path: string;
  created_at: string;
  updated_at: string;
};

function periodMonthFromInput(value: string): string {
  const [year, month] = value.split("-").map((part) => Number(part));

  return toPeriodMonth(year, month);
}

export async function GET(request: NextRequest) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.monthlyEarnings");
  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;
  const modelId = request.nextUrl.searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: t("modelIdMissing") },
      { status: 400 },
    );
  }

  const access = await requireModelAccess(supabase, profile, modelId);

  if (!access.ok) {
    return access.response;
  }

  const { data, error } = await supabase
    .from("model_earnings_reports")
    .select(
      "id, model_id, period_month, gross_revenue, model_share, visible_to_model, image_path, created_at, updated_at",
    )
    .eq("model_id", modelId)
    .not("period_month", "is", null)
    .order("period_month", { ascending: false });

  if (error) {
    console.error("Erro ao carregar os ganhos mensais:", error);

    return NextResponse.json(
      { error: tRoute("loadFailed") },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  const months = await Promise.all(
    ((data ?? []) as EarningsRow[]).map(async (row) => {
      const signed = await admin.storage
        .from("model-earnings")
        .createSignedUrl(row.image_path, SIGNED_URL_TTL_SECONDS);

      return {
        id: row.id,
        modelId: row.model_id,
        periodMonth: row.period_month,
        grossUsd: Number(row.gross_revenue ?? 0),
        published: row.visible_to_model,
        screenshotUrl: signed.error ? null : signed.data.signedUrl,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
  );

  return NextResponse.json({ months });
}

/**
 * Creates or replaces the figure for one month. The screenshot is required the
 * first time and optional afterwards, so an admin can fix a typo without
 * re-uploading the same image.
 */
export async function POST(request: NextRequest) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.monthlyEarnings");
  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  const formData = await request.formData();
  const modelId = formData.get("modelId");
  const period = formData.get("periodMonth");
  const grossUsdRaw = formData.get("grossUsd");
  const publishedRaw = formData.get("published");
  const image = formData.get("image");

  if (typeof modelId !== "string" || !modelId) {
    return NextResponse.json(
      { error: t("modelIdMissing") },
      { status: 400 },
    );
  }

  if (typeof period !== "string" || !PERIOD_PATTERN.test(period)) {
    return NextResponse.json(
      { error: tRoute("invalidMonth") },
      { status: 400 },
    );
  }

  const grossUsd = Number(grossUsdRaw);

  if (!Number.isFinite(grossUsd) || grossUsd < 0) {
    return NextResponse.json(
      { error: tRoute("invalidGross") },
      { status: 400 },
    );
  }

  const access = await requireModelAccess(supabase, profile, modelId);

  if (!access.ok) {
    return access.response;
  }

  const periodMonth = periodMonthFromInput(period);

  const { data: existing } = await supabase
    .from("model_earnings_reports")
    .select("id, gross_revenue, visible_to_model, image_path")
    .eq("model_id", modelId)
    .eq("period_month", periodMonth)
    .maybeSingle();

  const file = image instanceof File && image.size > 0 ? image : null;

  if (!file && !existing) {
    return NextResponse.json(
      { error: tRoute("screenshotRequired") },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  let imagePath = existing?.image_path as string | undefined;

  if (file) {
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: tRoute("fileTooLarge") },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: t("fileTypeNotAllowed") },
        { status: 400 },
      );
    }

    const safeFileName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const path = `${modelId}/${period}-${crypto.randomUUID()}-${safeFileName}`;

    const upload = await admin.storage
      .from("model-earnings")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upload.error) {
      console.error("Erro ao enviar a captura de tela:", upload.error);

      return NextResponse.json(
        { error: "Erro ao enviar a captura de tela." },
        { status: 500 },
      );
    }

    imagePath = path;
  }

  // The percentage split is stored alongside the gross so the row stays
  // self-describing; the card recomputes the share from the live percentages.
  const { data: payment } = await supabase
    .from("model_payments")
    .select("model_percentage, agency_percentage, marketing_percentage")
    .eq("model_id", modelId)
    .maybeSingle();

  const modelPct = Number(payment?.model_percentage ?? 60);
  const agencyPct = Number(payment?.agency_percentage ?? 20);
  const marketingPct = Number(payment?.marketing_percentage ?? 20);

  const published = publishedRaw === "true";

  const payload = {
    model_id: modelId,
    period_month: periodMonth,
    platform: "OnlyFans",
    period,
    report_date: periodMonth,
    gross_revenue: grossUsd,
    model_share: grossUsd * (modelPct / 100),
    agency_share: grossUsd * (agencyPct / 100),
    marketing_share: grossUsd * (marketingPct / 100),
    visible_to_model: published,
    image_path: imagePath as string,
    updated_by: profile.id,
  };

  const write = existing
    ? await supabase
        .from("model_earnings_reports")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase
        .from("model_earnings_reports")
        .insert({ ...payload, uploaded_by: profile.id })
        .select("id")
        .single();

  if (write.error) {
    if (file && imagePath) {
      await admin.storage.from("model-earnings").remove([imagePath]);
    }

    console.error("Erro ao salvar os ganhos mensais:", write.error);

    return NextResponse.json(
      { error: tRoute("saveFailed") },
      { status: 500 },
    );
  }

  // Replacing the screenshot leaves the old object orphaned otherwise.
  if (file && existing?.image_path && existing.image_path !== imagePath) {
    await admin.storage
      .from("model-earnings")
      .remove([existing.image_path as string]);
  }

  await logAuditEntry(supabase, {
    modelId,
    action: existing ? "monthly_earnings_updated" : "monthly_earnings_created",
    fieldName: "monthly_earnings",
    previousValue: existing
      ? `${existing.gross_revenue} USD · ${existing.visible_to_model ? "publicado" : "não publicado"}`
      : null,
    newValue: `${grossUsd} USD · ${published ? "publicado" : "não publicado"}`,
    actor: profile,
    source: "api:/api/models/monthly-earnings",
    summary: `Ganhos de ${period} ${existing ? "atualizados" : "registrados"}: ${grossUsd} USD (${published ? "publicado" : "não publicado"})`,
  });

  return NextResponse.json({ success: true, id: write.data.id });
}

/** Publish / unpublish, and amount-only edits. */
export async function PATCH(request: NextRequest) {
  const tRoute = await getTranslations("errors.monthlyEarnings");
  const auth = await requireStaff();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  const body = (await request.json()) as {
    id?: unknown;
    published?: unknown;
    grossUsd?: unknown;
  };

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json(
      { error: tRoute("reportIdMissing") },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("model_earnings_reports")
    .select("id, model_id, period, gross_revenue, visible_to_model")
    .eq("id", body.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: tRoute("reportNotFound") },
      { status: 404 },
    );
  }

  const access = await requireModelAccess(
    supabase,
    profile,
    existing.model_id as string,
  );

  if (!access.ok) {
    return access.response;
  }

  const update: Record<string, unknown> = { updated_by: profile.id };

  if (typeof body.published === "boolean") {
    update.visible_to_model = body.published;
  }

  if (body.grossUsd !== undefined) {
    const grossUsd = Number(body.grossUsd);

    if (!Number.isFinite(grossUsd) || grossUsd < 0) {
      return NextResponse.json(
        { error: tRoute("invalidGross") },
        { status: 400 },
      );
    }

    update.gross_revenue = grossUsd;
  }

  const { error } = await supabase
    .from("model_earnings_reports")
    .update(update)
    .eq("id", body.id);

  if (error) {
    console.error("Erro ao atualizar os ganhos mensais:", error);

    return NextResponse.json(
      { error: tRoute("updateFailed") },
      { status: 500 },
    );
  }

  await logAuditEntry(supabase, {
    modelId: existing.model_id as string,
    action: "monthly_earnings_updated",
    fieldName: "monthly_earnings",
    previousValue: `${existing.gross_revenue} USD · ${existing.visible_to_model ? "publicado" : "não publicado"}`,
    newValue: `${update.gross_revenue ?? existing.gross_revenue} USD · ${
      (update.visible_to_model ?? existing.visible_to_model)
        ? "publicado"
        : "não publicado"
    }`,
    actor: profile,
    source: "api:/api/models/monthly-earnings",
    summary: `Ganhos de ${existing.period ?? "—"} atualizados`,
  });

  return NextResponse.json({ success: true });
}
