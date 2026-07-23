import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ViewAsBanner from "@/components/admin/ViewAsBanner";
import type { ManagementRole } from "@/types/model";

type ModelNote = {
  id: string;
  body: string;
  created_by_name: string | null;
  created_by_role: string | null;
  created_at: string;
};

export default async function ViewAsRepresentativeModelPage({
  params,
}: {
  params: Promise<{ repId: string; modelId: string }>;
}) {
  const { repId, modelId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  const viewerRole = viewerProfile?.role as
    | ManagementRole
    | undefined;

  if (
    !viewerProfile ||
    !viewerProfile.active ||
    (viewerRole !== "owner" && viewerRole !== "administrator")
  ) {
    redirect("/admin/models");
  }

  const { data: representative } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", repId)
    .eq("role", "representative")
    .maybeSingle();

  if (!representative) {
    notFound();
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
      `,
    )
    .eq("id", modelId)
    .eq("representative_id", repId)
    .maybeSingle();

  if (modelError || !model) {
    notFound();
  }

  const { data: notes } = await supabase
    .from("model_notes")
    .select("id, body, created_by_name, created_by_role, created_at")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false })
    .limit(10);

  const modelNotes = (notes ?? []) as ModelNote[];

  return (
    <>
      <ViewAsBanner
        label={`Vendo como o representante ${representative.full_name ?? ""} veria`}
        backHref={`/admin/view-as/representative/${repId}`}
      />

      <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/admin/view-as/representative/${repId}`}
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
                        ? new Date(
                            model.birthday,
                          ).toLocaleDateString("pt-BR")
                        : "Não informado"
                    }
                  />
                  <InfoItem
                    label="Nacionalidade"
                    value={
                      model.nationality || "Não informado"
                    }
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
                          100,
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
                          model.last_login_at,
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
                        model.created_at,
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
                            {note.created_by_name || "Sistema"}
                          </span>
                          <span className="text-xs text-[#765c68]">
                            {new Date(
                              note.created_at,
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

                <p className="mt-4 rounded-xl border border-dashed border-[#eadfd8] bg-[#f7f1ec] px-4 py-3 text-xs text-[#765c68]">
                  A adição de notas fica desativada no modo de
                  visualização.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
