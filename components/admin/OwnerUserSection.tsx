import Link from "next/link";

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

type OwnerUserSectionProps = {
  title: string;
  role: UserRole;
  emptyMessage: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  limit?: number;
};

function SectionShell({
  title,
  count,
  viewAllHref,
  viewAllLabel,
  children,
}: {
  title: string;
  count: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-pink-400/30 bg-[#111114]">
      <div className="flex items-center justify-between gap-4 border-b border-pink-400/20 bg-[#291521] px-5 py-4">
        <h2 className="text-lg font-bold text-pink-100">
          {title}{" "}
          <span className="font-semibold text-pink-300/70">
            ({count})
          </span>
        </h2>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-pink-200 transition hover:bg-pink-400 hover:text-black"
          >
            {viewAllLabel ?? "View all"}
          </Link>
        )}
      </div>

      {children}
    </div>
  );
}

export default async function OwnerUserSection({
  title,
  role,
  emptyMessage,
  viewAllHref,
  viewAllLabel,
  limit,
}: OwnerUserSectionProps) {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("role", role)
    .order("full_name", { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <SectionShell title={title} count="!">
        <div className="px-5 py-10 text-center">
          <p className="font-semibold text-red-400">
            There was a problem loading this list.
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            {error.message}
          </p>
        </div>
      </SectionShell>
    );
  }

  const users = (data ?? []) as Profile[];

  return (
    <SectionShell
      title={title}
      count={String(users.length)}
      viewAllHref={viewAllHref}
      viewAllLabel={viewAllLabel}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse text-left">
          <thead className="bg-[#1c1119] text-xs uppercase tracking-[0.14em] text-pink-100/80">
            <tr>
              <th className="border-b border-r border-pink-400/20 px-5 py-4">
                Name
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
                  colSpan={3}
                  className="px-5 py-10 text-center text-zinc-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}

export function OwnerUserSectionSkeleton({
  title,
}: {
  title: string;
}) {
  return (
    <SectionShell title={title} count="...">
      <div className="space-y-3 px-5 py-6">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-14 animate-pulse rounded-xl bg-white/5"
          />
        ))}
      </div>
    </SectionShell>
  );
}
