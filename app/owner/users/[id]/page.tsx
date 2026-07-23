import Link from "next/link";
import { redirect } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DeleteAccountButton from "./DeleteAccountButton";
import { deleteAccountAction } from "./actions";

type UserRole =
  | "owner"
  | "administrator"
  | "representative"
  | "model";

type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  must_change_password: boolean;
};

function getRoleLabel(role: UserRole) {
  switch (role) {
    case "owner":
      return "Owner";
    case "administrator":
      return "Administrator";
    case "representative":
      return "Representative";
    case "model":
      return "Model";
    default:
      return role;
  }
}

export default async function OwnerUserManagePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ownerProfile, error: ownerError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    ownerError ||
    !ownerProfile ||
    !ownerProfile.active ||
    ownerProfile.role !== "owner"
  ) {
    redirect("/admin/models");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, must_change_password")
    .eq("id", params.id)
    .single();

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[#08080a] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-pink-300">
            Gerenciar Conta
          </h1>

          <p className="mt-4 text-red-400">
            Conta não encontrada.
          </p>

          <Link
            href="/owner/users"
            className="mt-4 inline-block rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-sm font-bold uppercase tracking-wider text-pink-200 transition hover:bg-pink-400 hover:text-black"
          >
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  const userProfile = profile as Profile;

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white lg:px-8">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">
              Owner Portal
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Gerenciar Conta
            </h1>

            <p className="mt-2 text-zinc-400">
              {userProfile.full_name || "Sem nome"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/owner/users"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-400 hover:text-pink-300"
            >
              Voltar
            </Link>

            <LogoutButton />
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-pink-400/30 bg-[#111114] p-6">
            <h2 className="mb-4 text-xl font-bold text-pink-200">
              Informações da Conta
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-zinc-400">Nome</p>
                <p className="mt-1 font-semibold text-white">
                  {userProfile.full_name || "Sem nome"}
                </p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Função</p>
                <p className="mt-1 font-semibold text-white mt-1">
                  {getRoleLabel(userProfile.role)}
                </p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Status</p>
                <p className="mt-1 font-semibold text-white">
                  {userProfile.active ? "Ativo" : "Inativo"}
                </p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">ID</p>
                <p className="mt-1 text-xs text-zinc-500 font-mono">
                  {userProfile.id}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-pink-400/30 bg-[#111114] p-6">
            <h2 className="mb-4 text-xl font-bold text-pink-200">
              Ações
            </h2>

            <div className="flex flex-wrap gap-3">
              <form
                action={async () => {
                  "use server";

                  const supabase = await createClient();

                  const {
                    data: { user },
                  } = await supabase.auth.getUser();

                  if (!user) {
                    redirect("/login");
                  }

                  const { data: ownerProfile } = await supabase
                    .from("profiles")
                    .select("role, active")
                    .eq("id", user.id)
                    .single();

                  if (
                    !ownerProfile ||
                    !ownerProfile.active ||
                    ownerProfile.role !== "owner"
                  ) {
                    redirect("/admin/models");
                  }

                  // Toggle active status
                  await supabase
                    .from("profiles")
                    .update({ active: !userProfile.active })
                    .eq("id", params.id);

                  redirect(`/owner/users/${params.id}`);
                }}
              >
                <button
                  type="submit"
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    userProfile.active
                      ? "border border-red-400/50 bg-red-400/10 text-red-200 hover:bg-red-400 hover:text-black"
                      : "border border-green-400/50 bg-green-400/10 text-green-200 hover:bg-green-400 hover:text-black"
                  }`}
                >
                  {userProfile.active ? "Desativar Conta" : "Ativar Conta"}
                </button>
              </form>

              <form
                action={async () => {
                  "use server";

                  const supabase = await createClient();
                  const admin = createAdminClient();

                  const {
                    data: { user },
                  } = await supabase.auth.getUser();

                  if (!user) {
                    redirect("/login");
                  }

                  const { data: ownerProfile } = await supabase
                    .from("profiles")
                    .select("role, active")
                    .eq("id", user.id)
                    .single();

                  if (
                    !ownerProfile ||
                    !ownerProfile.active ||
                    ownerProfile.role !== "owner"
                  ) {
                    redirect("/admin/models");
                  }

                  // Generate new password and require change
                  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
                  const array = new Uint32Array(16);
                  crypto.getRandomValues(array);
                  let password = "";
                  for (let i = 0; i < 16; i++) {
                    password += chars[array[i] % chars.length];
                  }

                  await admin.auth.admin.updateUserById(params.id, {
                    password,
                  });

                  await supabase
                    .from("profiles")
                    .update({ must_change_password: true })
                    .eq("id", params.id);

                  redirect(`/owner/users/${params.id}`);
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-blue-400/50 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-400 hover:text-black"
                >
                  Redefinir Senha
                </button>
              </form>

              {userProfile.role !== "owner" && (
                <form
                  action={async () => {
                    "use server";

                    const supabase = await createClient();

                    const {
                      data: { user },
                    } = await supabase.auth.getUser();

                    if (!user) {
                      redirect("/login");
                    }

                    const { data: ownerProfile } = await supabase
                      .from("profiles")
                      .select("role, active")
                      .eq("id", user.id)
                      .single();

                    if (
                      !ownerProfile ||
                      !ownerProfile.active ||
                      ownerProfile.role !== "owner"
                    ) {
                      redirect("/admin/models");
                    }

                    // Change role to administrator
                    await supabase
                      .from("profiles")
                      .update({ role: "administrator" })
                      .eq("id", params.id);

                    redirect(`/owner/users/${params.id}`);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-purple-400/50 bg-purple-400/10 px-4 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-400 hover:text-black"
                  >
                    Tornar Administrator
                  </button>
                </form>
              )}

              {(userProfile.role === "administrator" ||
                userProfile.role === "representative") && (
                <DeleteAccountButton
                  targetId={params.id}
                  displayName={
                    userProfile.full_name || "esta conta"
                  }
                  action={deleteAccountAction}
                />
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-pink-400/30 bg-[#111114] p-6">
            <h2 className="mb-4 text-xl font-bold text-pink-200">
              Status de Senha
            </h2>

            <p className="text-zinc-400">
              {userProfile.must_change_password
                ? "Usuário precisa alterar a senha no próximo login."
                : "Usuário não precisa alterar a senha."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
