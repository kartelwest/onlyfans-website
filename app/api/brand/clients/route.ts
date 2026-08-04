import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { createBrandOnlyClient } from "@/lib/brand/talent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const t = await getTranslations("errors.api");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return Response.json({ error: t("notAuthenticated") }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "administrator"].includes(profile.role)) {
    return Response.json({ error: t("permissionDenied") }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const { talent, error } = await createBrandOnlyClient({
      stageName: String(body.stageName ?? ""),
      displayName: String(body.displayName ?? ""),
      email: body.email ? String(body.email) : undefined,
      whatsapp: body.whatsapp ? String(body.whatsapp) : undefined,
      location: body.location ? String(body.location) : undefined,
      nationality: body.nationality ? String(body.nationality) : undefined,
      brandCategory: body.brandCategory ? String(body.brandCategory) : undefined,
      niche1: String(body.niche1 ?? ""),
      niche2: body.niche2 ? String(body.niche2) : undefined,
      niche3: body.niche3 ? String(body.niche3) : undefined,
      primaryPositioning: body.primaryPositioning ? String(body.primaryPositioning) : undefined,
      secondaryPositioning: body.secondaryPositioning ? String(body.secondaryPositioning) : undefined,
      aiGuidance: body.aiGuidance ? String(body.aiGuidance) : undefined,
    });

    if (error || !talent) {
      return Response.json({ error: error ?? "Erro ao criar cliente." }, { status: 400 });
    }

    return Response.json({ id: talent.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
