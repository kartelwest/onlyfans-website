import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAuditEntry } from "@/lib/audit/auditLogger";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

type DeleteBody = {
  modelId?: string;
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
        { error: t("notAuthenticated") },
        { status: 401 },
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json(
        { error: t("invalidProfile") },
        { status: 403 },
      );
    }

    const role = profile.role as ManagementRole;

    if (role !== "owner" && role !== "administrator") {
      return NextResponse.json(
        { error: t("noPermission") },
        { status: 403 },
      );
    }

    const body = (await request.json()) as DeleteBody;

    if (!body.modelId) {
      return NextResponse.json(
        { error: t("modelIdMissing") },
        { status: 400 },
      );
    }

    const adminSupabase = createAdminClient();

    const {
      data: model,
      error: modelError,
    } = await adminSupabase
      .from("models")
      .select("id, profile_id, display_name")
      .eq("id", body.modelId)
      .maybeSingle();

    if (modelError) {
      return NextResponse.json(
        { error: modelError.message },
        { status: 500 },
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: t("modelNotFound") },
        { status: 404 },
      );
    }

    const profileId = model.profile_id;

    const { error: deleteModelError } = await adminSupabase
      .from("models")
      .delete()
      .eq("id", body.modelId);

    if (deleteModelError) {
      return NextResponse.json(
        { error: deleteModelError.message },
        { status: 500 },
      );
    }

    if (profileId) {
      await adminSupabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      await adminSupabase.auth.admin.deleteUser(profileId);
    }

    await logAuditEntry(supabase, {
      modelId: body.modelId,
      action: "model_deleted",
      fieldName: null,
      previousValue: model.display_name,
      newValue: null,
      actor: {
        id: profile.id,
        fullName: profile.full_name || "Usuário",
        role,
      },
      source: "api:/api/models/delete",
      summary: `Modelo "${model.display_name}" excluída permanentemente`,
    });

    return NextResponse.json({
      success: true,
      message: `${model.display_name} foi excluída permanentemente.`,
    });
  } catch (error) {
    console.error("Erro ao excluir modelo:", error);

    return NextResponse.json(
      { error: t("internal") },
      { status: 500 },
    );
  }
}
