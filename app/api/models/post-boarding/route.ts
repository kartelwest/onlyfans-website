import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAuditEntry } from "@/lib/audit/auditLogger";
import {
  POST_BOARDING_ITEM_KEYS,
  findPostBoardingItem,
} from "@/lib/postboarding/definition";
import {
  loadPostBoarding,
  resolvePostBoardingAccess,
} from "@/lib/postboarding/server";
import { createClient } from "@/lib/supabase/server";

import type { ManagementRole } from "@/types/model";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  role: ManagementRole;
  active: boolean;
  status: string | null;
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthenticatedProfile() {
  const t = await getTranslations("errors.api");
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: fail(t("notAuthenticated"), 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, status")
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (profileError || !profile || !profile.active) {
    return { error: fail(t("invalidOrInactiveProfile"), 403) };
  }

  if (
    profile.role === "representative" &&
    profile.status !== "ativa"
  ) {
    return { error: fail(t("inactiveRepresentative"), 403) };
  }

  return { supabase, user, profile };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t = await getTranslations("errors.api");
  const tRoute = await getTranslations("errors.postBoardingApi");

  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const modelId = request.nextUrl.searchParams.get("modelId");

    if (!modelId) {
      return fail(t("modelIdMissing"), 400);
    }

    const access = await resolvePostBoardingAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.canRead) {
      return fail(tRoute("noViewPermission"), 403);
    }

    const sections = await loadPostBoarding({
      supabase: auth.supabase,
      modelId,
    });

    return NextResponse.json({
      sections,
      canEdit: access.canEdit,
    });
  } catch (error) {
    console.error("Erro ao carregar pós-embarque:", error);

    return fail(tRoute("loadFailed"), 500);
  }
}

export async function POST(request: NextRequest) {
  const tRoute = await getTranslations("errors.postBoardingApi");

  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as {
      modelId?: unknown;
      itemKey?: unknown;
      body?: unknown;
    };

    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    const itemKey = typeof body.itemKey === "string" ? body.itemKey : "";
    const noteBody = typeof body.body === "string" ? body.body.trim() : "";

    if (!modelId || !itemKey || !noteBody) {
      return fail(tRoute("invalidNote"), 400);
    }

    if (noteBody.length > 5000) {
      return fail(tRoute("noteTooLong"), 400);
    }

    const item = findPostBoardingItem(itemKey);

    if (!item || !POST_BOARDING_ITEM_KEYS.includes(itemKey)) {
      return fail(tRoute("unknownItem"), 400);
    }

    const access = await resolvePostBoardingAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.canEdit) {
      return fail(tRoute("noEditPermission"), 403);
    }

    const actor = {
      id: auth.profile.id,
      fullName: auth.profile.full_name || "Usuário",
      role: auth.profile.role,
    };

    // Copy into Model Notes first; the post-boarding row will reference it.
    const { data: modelNote, error: modelNoteError } = await auth.supabase
      .from("model_notes")
      .insert({
        model_id: modelId,
        body: noteBody,
        priority: "normal",
        pinned: false,
        archived: false,
        source: "post_boarding",
        created_context: itemKey,
        created_by: actor.id,
        created_by_name: actor.fullName,
        created_by_role: actor.role,
        updated_by: actor.id,
        updated_by_name: actor.fullName,
        updated_by_role: actor.role,
      })
      .select("id")
      .single();

    if (modelNoteError || !modelNote) {
      console.error("Erro ao copiar nota para model_notes:", modelNoteError);

      return fail(tRoute("saveFailed"), 500);
    }

    const { data: postBoardingNote, error: noteError } = await auth.supabase
      .from("model_post_boarding_notes")
      .insert({
        model_id: modelId,
        item_key: itemKey,
        section_key: item.sectionKey,
        item_title: item.title,
        item_description: item.description,
        body: noteBody,
        created_by: actor.id,
        created_by_name: actor.fullName,
        created_by_role: actor.role,
        updated_by: actor.id,
        updated_by_name: actor.fullName,
        updated_by_role: actor.role,
        model_note_id: modelNote.id,
      })
      .select("*")
      .single();

    if (noteError || !postBoardingNote) {
      await auth.supabase
        .from("model_notes")
        .delete()
        .eq("id", modelNote.id);

      console.error("Erro ao salvar nota de pós-embarque:", noteError);

      return fail(tRoute("saveFailed"), 500);
    }

    await logAuditEntry(auth.supabase, {
      modelId,
      action: "post_boarding_note",
      fieldName: itemKey,
      previousValue: null,
      newValue: noteBody,
      actor,
      source: "post_boarding",
      summary: `Pós-embarque — "${item.title}": nova anotação`,
    });

    return NextResponse.json({ note: postBoardingNote }, { status: 201 });
  } catch (error) {
    console.error("Erro inesperado ao criar nota de pós-embarque:", error);

    return fail(tRoute("unexpected"), 500);
  }
}

export async function PATCH(request: NextRequest) {
  const tRoute = await getTranslations("errors.postBoardingApi");

  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as {
      modelId?: unknown;
      noteId?: unknown;
      body?: unknown;
    };

    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    const noteId = typeof body.noteId === "string" ? body.noteId : "";
    const noteBody = typeof body.body === "string" ? body.body.trim() : "";

    if (!modelId || !noteId || !noteBody) {
      return fail(tRoute("invalidNote"), 400);
    }

    if (noteBody.length > 5000) {
      return fail(tRoute("noteTooLong"), 400);
    }

    const access = await resolvePostBoardingAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.canEdit) {
      return fail(tRoute("noEditPermission"), 403);
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from("model_post_boarding_notes")
      .select("*")
      .eq("id", noteId)
      .eq("model_id", modelId)
      .single();

    if (existingError || !existing) {
      return fail(tRoute("noteNotFound"), 404);
    }

    const isStaff =
      auth.profile.role === "owner" ||
      auth.profile.role === "administrator";
    const isAuthor =
      existing.created_by === auth.profile.id;

    if (!isStaff && !isAuthor) {
      return fail(tRoute("editOwnNotesOnly"), 403);
    }

    const item = findPostBoardingItem(existing.item_key as string);

    const actor = {
      id: auth.profile.id,
      fullName: auth.profile.full_name || "Usuário",
      role: auth.profile.role,
    };

    const previousBody = String(existing.body ?? "");

    if (previousBody === noteBody) {
      return NextResponse.json({ note: existing });
    }

    const { error: updateError } = await auth.supabase
      .from("model_post_boarding_notes")
      .update({
        body: noteBody,
        updated_by: actor.id,
        updated_by_name: actor.fullName,
        updated_by_role: actor.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .eq("model_id", modelId);

    if (updateError) {
      console.error("Erro ao atualizar nota de pós-embarque:", updateError);

      return fail(tRoute("saveFailed"), 500);
    }

    const modelNoteId = existing.model_note_id as string | null;

    if (modelNoteId) {
      const { error: copyUpdateError } = await auth.supabase
        .from("model_notes")
        .update({
          body: noteBody,
          updated_by: actor.id,
          updated_by_name: actor.fullName,
          updated_by_role: actor.role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", modelNoteId)
        .eq("model_id", modelId);

      if (copyUpdateError) {
        console.error(
          "Erro ao atualizar cópia em model_notes:",
          copyUpdateError,
        );
      }
    }

    await logAuditEntry(auth.supabase, {
      modelId,
      action: "post_boarding_note",
      fieldName: existing.item_key as string,
      previousValue: previousBody,
      newValue: noteBody,
      actor,
      source: "post_boarding",
      summary: `Pós-embarque — "${item?.title ?? existing.item_title}": anotação editada`,
    });

    const { data: updated } = await auth.supabase
      .from("model_post_boarding_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    return NextResponse.json({ note: updated ?? existing });
  } catch (error) {
    console.error("Erro inesperado ao editar nota de pós-embarque:", error);

    return fail(tRoute("unexpected"), 500);
  }
}
