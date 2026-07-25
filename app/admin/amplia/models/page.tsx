import Link from "next/link";
import { requireAdminAmpliaAccess } from "@/lib/amplia/admin";
import { getAmpliaClients, type AmpliaClient } from "@/lib/amplia/clients";

export const dynamic = "force-dynamic";

export default async function AdminAmpliaModelsPage() {
  await requireAdminAmpliaAccess();

  const { clients } = await getAmpliaClients();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              PORTAL PARA AMPLIA
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              SOCIAL MEDIA MODELS
            </h1>
          </div>

          <Link
            href="/admin/amplia/models/new"
            className="rounded-xl bg-pink-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-pink-400"
          >
            + Cliente Brand Growth
          </Link>
        </header>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#111115] text-xs uppercase tracking-[0.14em] text-white/55">
              <tr>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Tipo</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Instagram</th>
                <th className="px-6 py-4 font-semibold">X</th>
                <th className="px-6 py-4 font-semibold">Aprovações</th>
                <th className="px-6 py-4 font-semibold">Agendados hoje</th>
                <th className="px-6 py-4 text-right font-semibold">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {clients.length > 0 ? (
                clients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))
              ) : (
                <>
                  <ClientRow
                    client={dummyClient}
                    dummy
                  />
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-white/45"
                    >
                      Nenhum cliente encontrado. O item acima é apenas um placeholder de layout.
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function ClientRow({ client, dummy }: { client: AmpliaClient; dummy?: boolean }) {
  return (
    <tr className={`${dummy ? "opacity-50" : ""} hover:bg-white/[0.02]`}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {client.profilePhotoUrl ? (
            <img
              src={client.profilePhotoUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
              {client.displayName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div>
            <p className="font-semibold text-white">{client.displayName}</p>
            <p className="text-xs text-white/45">
              {client.stageName || client.fullName || "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-white/70">
        {client.type === "model" ? "Modelo Karay" : "BG-only"}
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={client.brandStatus} />
      </td>
      <td className="px-6 py-4 text-white/70">
        {client.connectedInstagram ? "Conectado" : "—"}
      </td>
      <td className="px-6 py-4 text-white/70">
        {client.connectedX ? "Conectado" : "—"}
      </td>
      <td className="px-6 py-4 text-white/70">
        {client.pendingApprovals > 0 ? client.pendingApprovals : "—"}
      </td>
      <td className="px-6 py-4 text-white/70">
        {client.scheduledToday > 0 ? client.scheduledToday : "—"}
      </td>
      <td className="px-6 py-4 text-right">
        <Link
          href={`/admin/amplia/models/${client.talentId}`}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
        >
          Abrir
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status || "not_requested";
  return (
    <span className="inline-flex rounded-lg bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
      {label.replace(/_/g, " ")}
    </span>
  );
}

const dummyClient: AmpliaClient = {
  id: "dummy",
  talentId: "dummy",
  type: "model",
  displayName: "Modelo Exemplo",
  stageName: "exemplo",
  fullName: null,
  location: null,
  email: null,
  whatsapp: null,
  profilePhotoUrl: null,
  active: true,
  brandStatus: "planning",
  connectedInstagram: false,
  connectedX: false,
  pendingApprovals: 0,
  scheduledToday: 0,
  createdAt: "",
  updatedAt: "",
};
