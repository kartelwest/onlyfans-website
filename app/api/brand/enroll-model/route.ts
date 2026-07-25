import { createClient } from "@/lib/supabase/server";
import { enrollModelInBrandGrowth } from "@/lib/brand/talent";

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

  if (!profile || !["owner", "administrator", "brand_manager"].includes(profile.role)) {
    return Response.json({ error: "Permissão negada." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const modelId = String(body.modelId ?? "");

    const { error } = await enrollModelInBrandGrowth(modelId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
