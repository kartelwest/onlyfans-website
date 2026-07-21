import Link from "next/link";
import { redirect } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

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

function getRoleStyle(role: UserRole) {
  switch (role) {
    case "owner":
      return "bg-purple-500/10 text-purple-300 ring-purple-500/30";

    case "administrator":
      return "bg-pink-500/10 text-pink-300 ring-pink-500/30";

    case "representative":
      return "bg-blue-500/10 text-blue-300 ring-blue-500/30";

    case "model":
      return "bg-green-500/10 text-green-300 ring-green-500/30";

    default:
      return "bg-zinc-500/10 text-zinc-300 ring-zinc-500/30";
  }
}

export default async function OwnerUsersPage() {
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

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .order("full_name", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#08080a] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-pink-300">
            Account Management
          </h1>

          <p className="mt-4 text-red-400">
            There was a problem loading the accounts.
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            {error.message}
          </p>
        </div>
      </main>
    );
  }

  const users = (profiles ?? []) as Profile[];

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white lg:px-8">
      <section className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">
              Owner Portal
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Account Management
            </h1>

            <p className="mt-2 text-zinc-400">
              Manage all KARRAY Models user accounts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/models"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-400 hover:text-pink-300"
            >
              Back to Models
            </Link>

            <LogoutButton />
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/owner/users/new?role=model"
            className="rounded-xl border border-pink-400/30 bg-[#161116] p-5 text-sm font-semibold text-pink-200 transition hover:border-pink-400 hover:bg-pink-400/10"
          >
            Add Model
          </Link>

          <Link
            href="/owner/users/new?role=administrator"
            className="rounded-xl border border-pink-400/30 bg-[#161116] p-5 text-sm font-semibold text-pink-200 transition hover:border-pink-400 hover:bg-pink-400/10"
          >
            Add Administrator
          </Link>

          <Link
            href="/owner/users/new?role=representative"
            className="rounded-xl border border-pink-400/30 bg-[#161116] p-5 text-sm font-semibold text-pink-200 transition hover:border-pink-400 hover:bg-pink-400/10"
          >
            Add Representative
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-pink-400/30 bg-[#111114]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead className="bg-[#291521] text-xs uppercase tracking-[0.14em] text-pink-100">
                <tr>
                  <th className="border-b border-r border-pink-400/20 px-5 py-4">
                    Name
                  </th>

                  <th className="border-b border-r border-pink-400/20 px-5 py-4">
                    Role
                  </th>

                  <th className="border-b border-r border-pink-400/20 px-5 py-4">
                    Status
                  </th>

                  <th className="border-b border-pink-400/20 px-5 py-4">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((profile) => (
                  <tr
                    key={profile.id}
                    className="border-b border-white/10 transition hover:bg-pink-400/[0.04]"
                  >
                    <td className="border-r border-white/10 px-5 py-5">
                      <p className="font-semibold text-white">
                        {profile.full_name || "No name"}
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        {profile.id}
                      </p>
                    </td>

                    <td className="border-r border-white/10 px-5 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getRoleStyle(
                          profile.role,
                        )}`}
                      >
                        {getRoleLabel(profile.role)}
                      </span>
                    </td>

                    <td className="border-r border-white/10 px-5 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          profile.active
                            ? "bg-green-500/10 text-green-300 ring-green-500/30"
                            : "bg-red-500/10 text-red-300 ring-red-500/30"
                        }`}
                      >
                        {profile.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-5 py-5">
                      <Link
                        href={`/owner/users/${profile.id}`}
                        className="inline-flex rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-pink-200 transition hover:bg-pink-400 hover:text-black"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-zinc-500"
                    >
                      No accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}