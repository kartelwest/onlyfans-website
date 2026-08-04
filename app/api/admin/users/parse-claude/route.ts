import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  computeConflicts,
  type NormalizedModelFields,
} from "@/lib/admin/modelOnboardingHelpers";
import { createClient } from "@/lib/supabase/server";
import { extractModelData } from "@/lib/anthropic/modelExtractor";

export const dynamic = "force-dynamic";

type CurrentForm = {
  fullName?: string;
  stageName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  country?: string;
};

export async function POST(request: Request) {
  const t = await getTranslations("errors.api");
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: t("mustBeSignedIn") },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, active, full_name")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !profile.active ||
      (profile.role !== "owner" && profile.role !== "administrator")
    ) {
      return NextResponse.json(
        { error: "Você não tem permissão para usar esta funcionalidade." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      text?: string;
      currentForm?: CurrentForm;
    };

    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Cole o texto da modelo antes de analisar." },
        { status: 400 },
      );
    }

    const extracted = await extractModelData(text);

    const publicFields: NormalizedModelFields = {
      fullName: extracted.fullName,
      stageName: extracted.stageName,
      email: extracted.emailValid ? extracted.email : null,
      emailValid: extracted.emailValid,
      phone: extracted.phoneValid ? extracted.phone : null,
      phoneDigits: extracted.phoneDigits,
      phoneValid: extracted.phoneValid,
      dateOfBirth: extracted.dateOfBirth,
      dateAmbiguous: extracted.dateAmbiguous,
      country: extracted.country,
    };

    const conflicts = computeConflicts(publicFields, body.currentForm ?? {});

    return NextResponse.json({
      extracted: publicFields,
      conflicts,
      missing: extracted.missing,
      unmapped: extracted.unmapped,
      originalText: text,
    });
  } catch (error) {
    console.error("Erro ao analisar texto com Claude:", error);

    const message =
      error instanceof Error ? error.message : "Erro inesperado.";

    if (
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("time-out")
    ) {
      return NextResponse.json(
        { error: "O Claude demorou muito para responder. Tente novamente." },
        { status: 504 },
      );
    }

    if (
      message.includes("ANTHROPIC_API_KEY") ||
      message.includes("not configured")
    ) {
      return NextResponse.json(
        { error: "Integração com Claude não configurada." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível analisar o texto." },
      { status: 500 },
    );
  }
}
