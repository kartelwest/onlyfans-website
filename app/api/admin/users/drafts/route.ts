import { NextResponse } from "next/server";

import {
  normalizeDateOfBirth,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeCountry,
} from "@/lib/admin/modelOnboardingHelpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";

export const dynamic = "force-dynamic";

type DraftRequest = {
  fullName?: string;
  stageName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  country?: string;
  originalText?: string;
  active?: boolean;
  websiteLoginEnabled?: boolean;
  draftModelId?: string;
};

export async function POST(request: Request) {
  let createdModelId: string | null = null;
  let isNewDraft = false;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Você precisa estar conectado." },
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
        { error: "Você não tem permissão para criar rascunhos." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as DraftRequest;

    const fullName = normalizeName(body.fullName);

    if (!fullName) {
      return NextResponse.json(
        { error: "Informe o nome completo para criar um rascunho." },
        { status: 400 },
      );
    }

    const stageName = normalizeName(body.stageName);
    const effectiveStageName = stageName || fullName || "";
    const emailResult = normalizeEmail(body.email);
    const phoneResult = normalizePhone(body.phone);
    const dateResult = normalizeDateOfBirth(body.dateOfBirth);
    const country = normalizeCountry(body.country);

    const adminSupabase = createAdminClient();

    const draftModelId =
      typeof body.draftModelId === "string" ? body.draftModelId : null;

    let slug = "";
    let modelNumber: number | null = null;
    let existingDraft:
      | { id: string; slug: string; model_number: number | null }
      | null = null;

    if (draftModelId) {
      const { data, error } = await adminSupabase
        .from("models")
        .select("id, slug, model_number, profile_id")
        .eq("id", draftModelId)
        .is("profile_id", null)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: "Rascunho não encontrado." },
          { status: 404 },
        );
      }

      existingDraft = data;
      slug = data.slug;
      modelNumber = data.model_number;
    } else {
      slug = await createUniqueModelSlug(adminSupabase, effectiveStageName);
      modelNumber = await getNextModelNumber(adminSupabase);
    }

    const insertOrUpdatePayload = {
      model_number: modelNumber,
      slug,
      display_name: fullName,
      stage_name: effectiveStageName,
      birthday: dateResult.value,
      nationality: country,
      email: emailResult.value,
      whatsapp: phoneResult.normalized,
      status: "candidate" as const,
      active: false,
      website_login_enabled: false,
      created_by: profile.id,
      onboarding_complete: false,
    };

    let modelId: string;

    if (existingDraft) {
      const { data, error } = await adminSupabase
        .from("models")
        .update(insertOrUpdatePayload)
        .eq("id", existingDraft.id)
        .select("id")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Não foi possível atualizar o rascunho." },
          { status: 500 },
        );
      }

      modelId = data.id;
    } else {
      const { data, error } = await adminSupabase
        .from("models")
        .insert(insertOrUpdatePayload)
        .select("id")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: `Não foi possível criar o rascunho: ${error?.message}` },
          { status: 500 },
        );
      }

      modelId = data.id;
      isNewDraft = true;
    }

    createdModelId = modelId;

    const originalText =
      typeof body.originalText === "string" ? body.originalText.trim() : "";

    if (originalText) {
      const { count: existingNoteCount } = await adminSupabase
        .from("model_notes")
        .select("*", { count: "exact", head: true })
        .eq("model_id", modelId)
        .eq("body", originalText)
        .eq("created_by", profile.id);

      if (!existingNoteCount) {
        const { error: noteError } = await adminSupabase
          .from("model_notes")
          .insert({
            model_id: modelId,
            body: originalText,
            priority: "normal",
            pinned: false,
            archived: false,
            created_by: profile.id,
            created_by_name: profile.full_name,
            created_by_role: profile.role,
            updated_by: profile.id,
            updated_by_name: profile.full_name,
            updated_by_role: profile.role,
          });

        if (noteError) {
          console.error("Erro ao salvar nota do texto original:", noteError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      modelId,
      slug,
      message: "Rascunho salvo com sucesso.",
    });
  } catch (error) {
    console.error("Erro inesperado ao criar rascunho:", error);

    if (createdModelId && isNewDraft) {
      try {
        const adminSupabase = createAdminClient();

        await adminSupabase
          .from("model_notes")
          .delete()
          .eq("model_id", createdModelId);

        await adminSupabase
          .from("models")
          .delete()
          .eq("id", createdModelId);
      } catch (cleanupError) {
        console.error("Erro ao desfazer criação do rascunho:", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado ao salvar o rascunho." },
      { status: 500 },
    );
  }
}
