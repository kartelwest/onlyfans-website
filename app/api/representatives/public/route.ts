import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicRepresentative = {
  id: string;
  fullName: string;
  role: "owner" | "administrator" | "representative";
};

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["owner", "administrator", "representative"])
      .eq("active", true)
      .eq("status", "ativa")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Erro ao carregar representantes públicos:", error);

      return NextResponse.json(
        { error: "Não foi possível carregar a lista de representantes." },
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
      { error: "Ocorreu um erro inesperado." },
      { status: 500 },
    );
  }
}
