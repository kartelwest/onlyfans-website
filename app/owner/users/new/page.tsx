import NewUserForm from "./NewUserForm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type UserRole = "model" | "administrator" | "representative";

type PageProps = {
    searchParams: Promise<{
        role?: string;
    }>;
};

function getRoleInformation(role: UserRole) {
    switch (role) {
        case "model":
            return {
                title: "Adicionar Modelo",
                description: "Crie uma nova conta para uma modelo.",
                roleLabel: "Modelo",
            };

        case "administrator":
            return {
                title: "Adicionar Administrador",
                description: "Crie uma nova conta de administrador.",
                roleLabel: "Administrador",
            };

        case "representative":
            return {
                title: "Adicionar Representante",
                description: "Crie uma nova conta de representante.",
                roleLabel: "Representante",
            };
    }
}

export default async function NewUserPage({
    searchParams,
}: PageProps) {
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

    const roleInformation = getRoleInformation(role);

    return (
        <main className="min-h-screen bg-[#08080a] px-4 py-10 text-white lg:px-8">
            <section className="mx-auto max-w-4xl">
                <Link
                    href="/owner/users"
                    className="text-sm font-semibold text-pink-300 transition hover:text-pink-200 hover:underline"
                >
                    ← Voltar para Gerenciamento de Contas
                </Link>

                <div className="mt-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">
                        Painel do Proprietário
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
                            Tipo de conta
                        </p>

                        <p className="mt-2 text-lg font-semibold text-pink-300">
                            {roleInformation.roleLabel}
                        </p>
                    </div>

                    <div className="mt-6">
                        <NewUserForm role={role} />
                    </div>
                </div>
            </section>
        </main>
    );
}