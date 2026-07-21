import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RepresentativePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !profile.active ||
    profile.role !== "representative"
  ) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
          KARRAY Models
        </p>

        <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
          Área do Representante
        </h1>

        <p className="mt-3 text-[#765c68]">
          Bem-vindo, {profile.full_name}.
        </p>
      </div>
    </main>
  );
}