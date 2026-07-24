import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type ModelNote = {
  id: string;
  body: string;
  created_by_name: string | null;
  created_by_role: string | null;
  created_at: string;
};

export default async function AreaDaModeloPage() {
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
    profile.role !== "model"
  ) {
    redirect("/login");
  }

  const { data: model, error: modelError } = await supabase
    .from("models")
    .select(
      `
        id,
        display_name,
        stage_name,
        instagram,
        twitter,
        onlyfans,
        onboarding_percentage,
        active,
        content_drive_url,
        latest_note_summary,
        last_login_at
      `
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  if (modelError || !model) {
    return (
      <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
            KARAY Models
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
            Área da Modelo
          </h1>

          <p className="mt-3 text-red-600">
            Perfil não encontrado. Entre em contato com a agência.
          </p>
        </div>
      </main>
    );
  }

  const { data: notes } = await supabase
    .from("model_notes")
    .select("id, body, created_by_name, created_by_role, created_at")
    .eq("model_id", model.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const modelNotes = (notes ?? []) as ModelNote[];

  return (
    <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
              KARAY Models
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
              Área da Modelo
            </h1>

            <p className="mt-3 text-[#765c68]">
              Bem-vinda, {model.display_name}
            </p>
          </div>

          <Link
            href="/login"
            className="text-sm font-semibold text-[#b06a87] hover:text-[#4b2438]"
          >
            Sair
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#eadfd8] bg-white p-6">
              <h2 className="text-xl font-bold text-[#4b2438]">
                Suas Plataformas
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <PlatformCard
                  name="Instagram"
                  username={model.instagram}
                />
                <PlatformCard
                  name="Twitter"
                  username={model.twitter}
                />
                <PlatformCard
                  name="OnlyFans"
                  username={model.onlyfans}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#eadfd8] bg-white p-6">
              <h2 className="text-xl font-bold text-[#4b2438]">
                Progresso do Onboarding
              </h2>

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

                <p className="mt-4 text-sm text-[#765c68]">
                  {model.onboarding_percentage === 100
                    ? "Onboarding concluído!"
                    : "Onboarding em andamento"}
                </p>
              </div>
            </div>

            {model.content_drive_url && (
              <div className="rounded-2xl border border-[#b06a87] bg-[#4b2438] p-6">
                <h2 className="text-xl font-bold text-white">
                  Enviar Conteúdo
                </h2>

                <p className="mt-2 text-sm text-white/80">
                  Acesse sua pasta do Google Drive para enviar fotos e vídeos.
                </p>

                <a
                  href={model.content_drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#4b2438] transition hover:bg-[#f7f1ec]"
                >
                  Acessar Pasta de Conteúdo
                </a>
              </div>
            )}
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
                          {note.created_by_name || "Sistema"}
                        </span>
                        <span className="text-xs text-[#765c68]">
                          {new Date(
                            note.created_at
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#4b2438]">
                        {note.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlatformCard({
  name,
  username,
}: {
  name: string;
  username: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#eadfd8] bg-[#f7f1ec] p-4">
      <p className="text-sm font-semibold text-[#765c68]">{name}</p>
      <p className="mt-1 text-sm font-medium text-[#4b2438]">
        {username || "Não configurado"}
      </p>
    </div>
  );
}