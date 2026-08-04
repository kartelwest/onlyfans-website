import NewUserForm from "./NewUserForm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

type UserRole = "model" | "administrator" | "representative";

type RepresentativeOption = {
    id: string;
    fullName: string;
    role: string;
};

type PageProps = {
    searchParams: Promise<{
        role?: string;
    }>;
};

function getRoleInformation(
    role: UserRole,
    t: (key: string) => string,
) {
    return {
        title: t(`${role}.title`),
        description: t(`${role}.description`),
        roleLabel: t(`${role}.label`),
    };
}

export default async function NewUserPage({
    searchParams,
}: PageProps) {
    const t = await getTranslations("owner.newUserPage");
    const params = await searchParams;
    const role = params.role as UserRole;

    if (
        role !== "model" &&
        role !== "administrator" &&
        role !== "representative"
    ) {
        redirect("/owner/users");
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

    if (
        error ||
        !profile ||
        !profile.active ||
        profile.role !== "owner"
    ) {
        redirect("/admin/models");
    }

    const roleInformation = getRoleInformation(role, t);

    const { data: representatives } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["owner", "administrator", "representative"])
        .eq("active", true)
        .order("full_name", { ascending: true });

    const representativeOptions: RepresentativeOption[] = (representatives ?? [])
        .filter((row): row is { id: string; full_name: string; role: string } => Boolean(row.id && row.full_name))
        .map((row) => ({
            id: row.id,
            fullName: row.full_name,
            role: row.role,
        }));

    return (
        <main className="min-h-screen bg-[#08080a] px-4 py-10 text-white lg:px-8">
            <section className="mx-auto max-w-4xl">
                <Link
                    href="/owner/users"
                    className="text-sm font-semibold text-pink-300 transition hover:text-pink-200 hover:underline"
                >
                    {t("back")}
                </Link>

                <div className="mt-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">
                        {t("panel")}
                    </p>

                    <h1 className="mt-3 text-3xl font-bold text-white lg:text-4xl">
                        {roleInformation.title}
                    </h1>

                    <p className="mt-3 text-zinc-400">
                        {roleInformation.description}
                    </p>
                </div>

                <div className="mt-10 rounded-2xl border border-pink-400/30 bg-[#111114] p-6 lg:p-8">
                    <div className="rounded-xl border border-pink-400/20 bg-[#1a1218] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            {t("accountType")}
                        </p>

                        <p className="mt-2 text-lg font-semibold text-pink-300">
                            {roleInformation.roleLabel}
                        </p>
                    </div>

                    <div className="mt-6">
                        <NewUserForm
                            role={role}
                            representatives={role === "model" ? representativeOptions : []}
                        />
                    </div>
                </div>
            </section>
        </main>
    );
}