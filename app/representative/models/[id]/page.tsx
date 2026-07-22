import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type Model = {
  id: string;
  display_name: string;
  stage_name: string | null;
  birthday: string | null;
  nationality: string | null;
  city: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  twitter: string | null;
  onlyfans: string | null;
  onboarding_percentage: number;
  active: boolean;
  latest_note_summary: string | null;
  last_login_at: string | null;
  created_at: string;
};

type ModelNote = {
  id: string;
  content: string;
  author_name: string | null;
  author_role: string | null;
  created_at: string;
};

export default async function RepresentativeModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Verify model is assigned to this representative
  const { data: model, error: modelError } = await supabase
    .from("models")
    .select(
      `
        id,
        display_name,
        stage_name,
        birthday,
        nationality,
        city,
        email,
        whatsapp,
        instagram,
        twitter,
        onlyfans,
        onboarding_percentage,
        active,
        latest_note_summary,
        last_login_at,
        created_at
      `
    )
    .eq("id", id)
    .eq("representative_id", user.id)
    .maybeSingle();

  if (modelError || !model) {
    notFound();
  }

  const { data: notes, error: notesError } = await supabase
    .from("model_notes")
    .select("id, content, author_name, author_role, created_at")
    .eq("model_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const modelNotes = (notes ?? []) as ModelNote[];

  return (
    <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/representative"
          className="text-sm font-semibold text-[#b06a87] hover:text-[#4b2438]"
        >
          ← Voltar para modelos
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#eadfd8] bg-white p-6">
              <h2 className="text-xl font-bold text-[#4b2438]">
                {model.display_name}
              </h2>

              {model.stage_name && (
                <p className="mt-1 text-[#765c68]">
                  Nome artístico: {model.stage_name}
                </p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  label="Data de nascimento"
                  value={
                    model.birthday
                      ? new Date(model.birthday).toLocaleDateString(
                          "pt-BR"
                        )
                      : "Não informado"
                  }
                />
                <InfoItem
                  label="Nacionalidade"
                  value={model.nationality || "Não informado"}
                />
                <InfoItem
                  label="Cidade"
                  value={model.city || "Não informado"}
                />
                <InfoItem
                  label="E-mail"
                  value={model.email || "Não informado"}
                />
                <InfoItem
                  label="WhatsApp"
                  value={model.whatsapp || "Não informado"}
                />
                <InfoItem
                  label="Instagram"
                  value={model.instagram || "Não informado"}
                />
                <InfoItem
                  label="Twitter"
                  value={model.twitter || "Não informado"}
                />
                <InfoItem
                  label="OnlyFans"
                  value={model.onlyfans || "Não informado"}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#eadfd8] bg-white p-6">
              <h3 className="text-lg font-bold text-[#4b2438]">
                Progresso do Onboarding
              </h3>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#765c68]">
                    Progresso atual
                  </span>
                  <span className="text-xl font-bold text-[#b06a87]">
                    {model.onboarding_percentage}%
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eadfd8]">
                  <div
                    className={`h-full rounded-full ${
                      model.onboarding_percentage === 100
                        ? "bg-green-500"
                        : model.onboarding_percentage > 0
                          ? "bg-yellow-400"
                          : "bg-red-400"
                    }`}
                    style={{
                      width: `${Math.min(
                        Math.max(model.onboarding_percentage, 0),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#eadfd8] bg-white p-6">
              <h3 className="text-lg font-bold text-[#4b2438]">
                Status
              </h3>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#765c68]">
                    Status da conta
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      model.active
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {model.active ? "Ativa" : "Inativa"}
                  </span>
                </div>

                {model.last_login_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#765c68]">
                      Último acesso
                    </span>
                    <span className="text-sm font-semibold text-[#4b2438]">
                      {new Date(
                        model.last_login_at
                      ).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#765c68]">
                    Cadastrada em
                  </span>
                  <span className="text-sm font-semibold text-[#4b2438]">
                    {new Date(
                      model.created_at
                    ).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#eadfd8] bg-white p-6">
              <h3 className="text-lg font-bold text-[#4b2438]">
                Notas Recentes
              </h3>

              {modelNotes.length === 0 ? (
                <p className="mt-4 text-sm text-[#765c68]">
                  Nenhuma nota registrada.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {modelNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-[#eadfd8] bg-[#f7f1ec] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#4b2438]">
                          {note.author_name || "Sistema"}
                        </span>
                        <span className="text-xs text-[#765c68]">
                          {new Date(
                            note.created_at
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#4b2438]">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form
                action={async (formData: FormData) => {
                  "use server";

                  const supabase = await createClient();
                  const content = formData.get("content") as string;

                  if (!content || !content.trim()) {
                    return;
                  }

                  const {
                    data: { user },
                  } = await supabase.auth.getUser();

                  if (!user) {
                    return;
                  }

                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name, role")
                    .eq("id", user.id)
                    .single();

                  await supabase.from("model_notes").insert({
                    model_id: id,
                    author_id: user.id,
                    author_name: profile?.full_name || null,
                    author_role: profile?.role || null,
                    content: content.trim(),
                  });
                }}
                className="mt-4"
              >
                <textarea
                  name="content"
                  placeholder="Adicionar uma nota..."
                  rows={3}
                  className="w-full rounded-xl border border-[#eadfd8] bg-[#fffaf6] px-4 py-3 text-sm text-[#4b2438] outline-none focus:border-[#b06a87] focus:ring-4 focus:ring-[#b06a87]/15"
                  required
                />
                <button
                  type="submit"
                  className="mt-2 w-full rounded-xl bg-[#4b2438] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#321725]"
                >
                  Adicionar Nota
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#765c68]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[#4b2438]">
        {value}
      </p>
    </div>
  );
}
