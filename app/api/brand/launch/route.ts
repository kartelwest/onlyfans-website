import { createClient } from "@/lib/supabase/server";
import { generateLaunchPacket } from "@/lib/brand/ai/launchPacket";
import { getTalentWithBrandProfile } from "@/lib/brand/talent";

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

  if (!profile || !["owner", "administrator"].includes(profile.role)) {
    return Response.json({ error: "Permissão negada." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const talentId = String(body.talentId ?? "");

    const { talent, brandProfile, error } = await getTalentWithBrandProfile(talentId);
    if (error || !talent || !brandProfile) {
      return Response.json({ error: error ?? "Cliente não encontrado." }, { status: 404 });
    }

    const packet = await generateLaunchPacket(talent, brandProfile);

    return Response.json(packet, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
