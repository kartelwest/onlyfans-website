

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import NewUserForm, { type AssigneeOption } from "./NewUserForm";

export const dynamic = "force-dynamic";

type NewUserRole =
  | "model"
  | "representative"
  | "administrator";

type NewUserPageProps = {
  searchParams: Promise<{
    role?: string;
    draft?: string;
  }>;
};

type DraftModel = {
  id: string;
  slug: string;
  display_name: string | null;
  stage_name: string | null;
  email: string | null;
  whatsapp: string | null;
  birthday: string | null;
  nationality: string | null;
};

export default async function NewUserPage({
  searchParams,
}: NewUserPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  if (
    profile.role !== "owner" &&
    profile.role !== "administrator"
  ) {
    redirect("/login");
  }

  const params = await searchParams;

  const requestedRole = params.role;

  const allowedRoles: NewUserRole[] = [
    "model",
    "representative",
    "administrator",
  ];

  const role: NewUserRole = allowedRoles.includes(
    requestedRole as NewUserRole,
  )
    ? (requestedRole as NewUserRole)
    : "model";

  if (
    role === "administrator" &&
    profile.role !== "owner"
  ) {
    redirect("/admin/models");
  }

  let drafts: DraftModel[] = [];
  let selectedDraft: DraftModel | null = null;
  let assignees: AssigneeOption[] = [];

  if (role === "model") {
    // Who a new model may be handed to: active representatives and admins,
    // never an inactive or archived account. Loaded from the database, and
    // filtered here rather than in the browser.
    const { data: assignableRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, active")
      .in("role", ["representative", "administrator"])
      .eq("active", true)
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });

    assignees = (assignableRows ?? []).map((row) => ({
      id: row.id as string,
      fullName: (row.full_name as string | null)?.trim() || "Sem nome",
      role:
        row.role === "administrator"
          ? "Administrador"
          : "Representante",
      email: (row.email as string | null) ?? null,
    }));

    const { data: draftModels } = await supabase
      .from("models")
      .select(
        "id, slug, display_name, stage_name, email, whatsapp, birthday, nationality",
      )
      .is("profile_id", null)
      .eq("created_by", profile.id)
      .eq("status", "candidate")
      .order("created_at", { ascending: false });

    drafts = (draftModels ?? []) as DraftModel[];

    if (params.draft) {
      const matchingDraft = drafts.find(
        (draft) => draft.slug === params.draft,
      );

      selectedDraft = matchingDraft ?? null;
    }
  }

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY Models CRM
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {getPageTitle(role)}
            </h1>

            <p className="mt-2 text-sm text-white/55">
              Cadastre um novo acesso no sistema.
            </p>
          </div>

          <Link
            href="/admin/models"
            className="w-fit rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            Voltar para modelos
          </Link>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <RoleLink
            href="/admin/users/new?role=model"
            active={role === "model"}
          >
            Modelo
          </RoleLink>

          <RoleLink
            href="/admin/users/new?role=representative"
            active={role === "representative"}
          >
            Representante
          </RoleLink>

          {profile.role === "owner" && (
            <RoleLink
              href="/admin/users/new?role=administrator"
              active={role === "administrator"}
            >
              Administrador
            </RoleLink>
          )}
        </div>

        <NewUserForm
          role={role}
          currentUserRole={profile.role}
          drafts={drafts}
          selectedDraft={selectedDraft}
          assignees={assignees}
        />
      </div>
    </main>
  );
}

function RoleLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border px-5 py-3 text-center text-sm font-bold transition ${
        active
          ? "border-pink-400 bg-pink-500 text-white"
          : "border-white/10 bg-white/5 text-white/60 hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-pink-200"
      }`}
    >
      {children}
    </Link>
  );
}

function getPageTitle(role: NewUserRole) {
  if (role === "representative") {
    return "Adicionar representante";
  }

  if (role === "administrator") {
    return "Adicionar administrador";
  }

  return "Adicionar modelo";
}
