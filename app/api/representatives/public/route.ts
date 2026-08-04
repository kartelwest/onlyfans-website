import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type PublicRepresentative = {
  id: string;
  fullName: string;
  role: "owner" | "administrator" | "representative";
};

export async function GET() {
  const tRoute = await getTranslations("errors.representativesApi");
  try {
    const supabase = createAdminClient();

    // Filtered on active, not on status: profiles.active is what the
    // lifecycle trigger keeps in step with status for representatives, and it
    // is the column that exists whether or not the lifecycle migration has
    // run. An archived account is inactive, so it never reaches this list.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["owner", "administrator", "representative"])
      .eq("active", true)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Erro ao carregar representantes públicos:", error);

      return NextResponse.json(
        { error: tRoute("listFailed") },
        { status: 500 },
      );
    }

    const representatives: PublicRepresentative[] = (data ?? [])
      .filter((row): row is { id: string; full_name: string; role: string } => Boolean(row.id && row.full_name))
      .map((row) => ({
        id: row.id,
        fullName: row.full_name,
        role:
          row.role === "owner" || row.role === "administrator"
            ? row.role
            : "representative",
      }));

    return NextResponse.json({ representatives });
  } catch (error) {
    console.error("Erro inesperado ao listar representantes:", error);

    return NextResponse.json(
      { error: tRoute("unexpected") },
      { status: 500 },
    );
  }
}
