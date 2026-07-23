import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ViewAsBanner from "@/components/admin/ViewAsBanner";
import type { ManagementRole, ModelStatus } from "@/types/model";

type Model = {
  id: string;
  display_name: string;
  stage_name: string | null;
  instagram: string | null;
  whatsapp: string | null;
  onboarding_percentage: number;
  status: string | null;
  active: boolean;
  latest_note_summary: string | null;
  last_login_at: string | null;
};

const statusDotConfig: Record<
  ModelStatus,
  { className: string; label: string }
> = {
  active: { className: "bg-green-500", label: "Ativo" },
  inactive: { className: "bg-gray-400", label: "Inativo" },
  candidate: { className: "bg-yellow-400", label: "Candidata" },
  denied: { className: "bg-red-500", label: "Negada" },
};

function normalizeModelStatus(
  status: string | null,
  active: boolean,
): ModelStatus {
  if (
    status === "active" ||
    status === "inactive" ||
    status === "candidate" ||
    status === "denied"
  ) {
    return status;
  }

  return active ? "active" : "inactive";
}

export default async function ViewAsRepresentativePage({
  params,
}: {
  params: Promise<{ repId: string }>;
}) {
  const { repId } = await params;
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

  const { data: representative, error: representativeError } =
    await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", repId)
      .eq("role", "representative")
      .maybeSingle();

  if (representativeError || !representative) {
    notFound();
  }

  const { data: models, error } = await supabase
    .from("models")
    .select(
      `
        id,
        display_name,
        stage_name,
        instagram,
        whatsapp,
        onboarding_percentage,
        status,
        active,
        latest_note_summary,
        last_login_at
      `,
    )
    .eq("representative_id", repId)
    .order("display_name", { ascending: true });

  if (error) {
    return (
      <>
        <ViewAsBanner
          label={`Vendo como o representante ${representative.full_name ?? ""} veria`}
          backHref="/admin/models"
        />

        <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
              KARRAY Models
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
              Área do Representante
            </h1>

            <p className="mt-3 text-red-600">
              Erro ao carregar modelos.
            </p>
          </div>
        </main>
      </>
    );
  }

  const assignedModels = (models ?? []) as Model[];

  return (
    <>
      <ViewAsBanner
        label={`Vendo como o representante ${representative.full_name ?? ""} veria`}
        backHref="/admin/models"
      />

      <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
                KARRAY Models
              </p>

              <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
                Área do Representante
              </h1>

              <p className="mt-3 text-[#765c68]">
                Bem-vindo, {representative.full_name}.
              </p>
            </div>

            <div className="text-sm text-[#765c68]">
              {assignedModels.length} modelo(s) atribuída(s)
            </div>
          </div>

          {assignedModels.length === 0 ? (
            <div className="rounded-2xl border border-[#eadfd8] bg-white p-8 text-center">
              <p className="text-[#765c68]">
                Nenhuma modelo atribuída a este representante
                ainda.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {assignedModels.map((model) => {
                const modelStatus = normalizeModelStatus(
                  model.status,
                  model.active,
                );
                const statusDot = statusDotConfig[modelStatus];

                return (
                  <Link
                    key={model.id}
                    href={`/admin/view-as/representative/${repId}/models/${model.id}`}
                    className="block rounded-2xl border border-[#eadfd8] bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#b06a87]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#eadfd8] bg-[#f7f1ec] text-2xl font-bold text-[#4b2438]">
                        {model.display_name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="truncate text-lg font-bold text-[#4b2438]">
                          {model.display_name}
                        </h3>

                        {model.stage_name && (
                          <p className="text-sm text-[#765c68]">
                            {model.stage_name}
                          </p>
                        )}
                      </div>

                      <div
                        title={statusDot.label}
                        className={`h-3 w-3 shrink-0 rounded-full ${statusDot.className}`}
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#765c68]">
                          Onboarding
                        </span>
                        <span className="font-semibold text-[#4b2438]">
                          {model.onboarding_percentage}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#eadfd8]">
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
                              Math.max(
                                model.onboarding_percentage,
                                0,
                              ),
                              100,
                            )}%`,
                          }}
                        />
                      </div>

                      {model.latest_note_summary && (
                        <p className="mt-3 text-xs text-[#765c68] line-clamp-2">
                          {model.latest_note_summary}
                        </p>
                      )}

                      {model.last_login_at && (
                        <p className="mt-2 text-xs text-[#765c68]">
                          Último acesso:{" "}
                          {new Date(
                            model.last_login_at,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
