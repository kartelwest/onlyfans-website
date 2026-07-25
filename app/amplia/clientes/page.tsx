import Link from "next/link";
import { AmpliaLayout, EmptyState } from "@/components/amplia/AmpliaLayout";
import { requireAmpliaAccess } from "@/lib/amplia/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AmpliaClientesPage() {
  await requireAmpliaAccess();

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("talents")
    .select("id, display_name, stage_name, active, brand_profiles(id, brand_status)")
    .order("display_name", { ascending: true });

  return (
    <AmpliaLayout
      title="Clientes"
      actions={
        <Link
          href="/amplia/clientes/novo"
          className="rounded-xl bg-pink-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-pink-400"
        >
          + Novo cliente
        </Link>
      }
    >
      {clients && clients.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111115]">
          <table className="w-full border-collapse">
            <thead className="bg-[#2a1521] text-left">
              <tr className="border-b border-pink-400/20">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Nome
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Status da marca
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-pink-100">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const brandProfile = client.brand_profiles as { id?: string; brand_status?: string } | null;
                return (
                  <tr key={client.id} className="border-b border-white/10 hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <span className="font-bold text-white">
                        {client.display_name || client.stage_name || "Sem nome"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {brandProfile?.brand_status ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/amplia/clientes/${client.id}`}
                        className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Nenhum cliente"
          description="Adicione o primeiro cliente de Brand Growth para começar."
        >
          <Link
            href="/amplia/clientes/novo"
            className="rounded-xl bg-pink-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-pink-400"
          >
            + Novo cliente
          </Link>
        </EmptyState>
      )}
    </AmpliaLayout>
  );
}
