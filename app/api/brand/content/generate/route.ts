import { createClient } from "@/lib/supabase/server";
import { generateContent } from "@/lib/brand/ai/contentStudio";
import { getTalentWithBrandProfile } from "@/lib/brand/talent";
import { getClientBoundaries, evaluateContentAgainstBoundaries } from "@/lib/brand/boundaries";
import type { ContentType, Platform } from "@/types/brand";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "administrator", "brand_manager", "content_manager"].includes(profile.role)) {
    return Response.json({ error: "Permissão negada." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const talentId = String(body.talentId ?? "");
    const platform = String(body.platform ?? "instagram") as Platform;
    const contentType = String(body.contentType ?? "feed_image") as ContentType;

    const { talent, brandProfile, error } = await getTalentWithBrandProfile(talentId);
    if (error || !talent || !brandProfile) {
      return Response.json({ error: error ?? "Cliente não encontrado." }, { status: 404 });
    }

    const generated = await generateContent({
      talent,
      brandProfile,
      platform,
      contentType,
      objective: body.objective ? String(body.objective) : undefined,
      pillar: body.pillar ? String(body.pillar) : undefined,
      language: body.language ? String(body.language) : undefined,
      dailyDirective: body.dailyDirective ? String(body.dailyDirective) : null,
    });

    const boundaries = await getClientBoundaries(talentId);
    if (boundaries) {
      const captionCheck = evaluateContentAgainstBoundaries(
        `${generated.caption} ${generated.cta} ${generated.body}`,
        boundaries,
      );
      if (!captionCheck.safe) {
        return Response.json(
          {
            caption: generated.caption,
            hashtags: generated.hashtags,
            body: generated.body,
            cta: generated.cta,
            riskNotes: generated.riskNotes.concat(captionCheck.violations),
            blocked: true,
          },
          { status: 400 },
        );
      }
    }

    return Response.json(generated, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
