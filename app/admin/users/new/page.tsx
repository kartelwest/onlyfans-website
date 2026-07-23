

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import NewUserForm from "./NewUserForm";

export const dynamic = "force-dynamic";

type NewUserRole =
  | "model"
  | "representative"
  | "administrator";

type NewUserPageProps = {
  searchParams: Promise<{
    role?: string;
  }>;
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
