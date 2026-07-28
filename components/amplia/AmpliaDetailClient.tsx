"use client";

import { useState } from "react";
import Link from "next/link";
import type { AmpliaClientDetail } from "@/lib/amplia/clients";

const TABS = [
  { id: "estrategia", label: "Estratégia" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "calendario", label: "Calendário" },
  { id: "aprovacoes", label: "Aprovações" },
  { id: "playbook", label: "Playbook (X)" },
  { id: "resultados", label: "Resultados" },
  { id: "limites", label: "Limites/Consentimento" },
  { id: "alertas", label: "Alertas" },
];

interface AmpliaDetailClientProps {
  client: AmpliaClientDetail;
}

export default function AmpliaDetailClient({
  client,
}: AmpliaDetailClientProps) {
  const [activeTab, setActiveTab] = useState("estrategia");

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/admin/socialmediamodels/models"
              className="text-xs font-semibold text-white/55 transition hover:text-white"
            >
              ← Voltar para SOCIAL MEDIA MODELS
            </Link>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              {client.displayName}
            </h1>

            <p className="mt-2 text-sm text-white/55">
              {client.type === "model" ? "Modelo Karay" : "Cliente Brand Growth"} — {client.stageName || client.fullName || "—"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
              Status: {client.brandStatus}
            </span>
          </div>
        </header>

        <nav className="mt-8 border-b border-white/10">
          <div className="flex gap-2 overflow-x-auto pb-4">
            {TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${selected
                      ? "border-pink-400/60 bg-pink-500/20 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-8">
          {activeTab === "estrategia" && <StrategyTab client={client} />}
          {activeTab === "conteudo" && <EmptyTab title="Conteúdo" text="Nenhum conteúdo gerado ainda." />}
          {activeTab === "calendario" && <EmptyTab title="Calendário" text="Nenhum item agendado." />}
          {activeTab === "aprovacoes" && <EmptyTab title="Aprovações" text="Nenhum conteúdo aguardando aprovação." />}
          {activeTab === "playbook" && <EmptyTab title="Playbook (X)" text="Nenhuma tarefa do playbook hoje." />}
          {activeTab === "resultados" && <EmptyTab title="Resultados" text="Métricas e analytics aparecerão aqui." />}
          {activeTab === "limites" && <BoundariesTab client={client} />}
          {activeTab === "alertas" && <EmptyTab title="Alertas" text="Nenhum alerta crítico." />}
        </div>
      </div>
    </main>
  );
}

function StrategyTab({ client }: { client: AmpliaClientDetail }) {
  const bp = client.brandProfile;

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card title="Posicionamento">
        <ReadOnly label="Categoria" value={bp?.brandCategory} />
        <ReadOnly label="Nicho 1" value={bp?.niche1} />
        <ReadOnly label="Nicho 2" value={bp?.niche2} />
        <ReadOnly label="Nicho 3" value={bp?.niche3} />
        <ReadOnly label="Posicionamento primário" value={bp?.primaryPositioning} />
        <ReadOnly label="Posicionamento secundário" value={bp?.secondaryPositioning} />
      </Card>

      <Card title="Diretrizes de IA">
        <ReadOnly label="Diretriz permanente" value={bp?.aiGuidance} multiline />
        <ReadOnly label="Diretriz do dia" value={bp?.dailyDirective || null} />
        <ReadOnly label="Idioma padrão" value={bp?.defaultLanguages?.join(", ")} />
      </Card>
    </section>
  );
}

function BoundariesTab({ client }: { client: AmpliaClientDetail }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card title="Consentimentos">
        {Object.entries(client.consents).length > 0 ? (
          <ul className="space-y-2 text-sm text-white/70">
            {Object.entries(client.consents).map(([key, granted]) => (
              <li key={key} className="flex items-center justify-between">
                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                <span className={granted ? "text-green-400" : "text-red-400"}>
                  {granted ? "Sim" : "Não"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/45">Nenhum consentimento registrado.</p>
        )}
      </Card>

      <Card title="Limites">
        {client.boundaries ? (
          <div className="space-y-4 text-sm text-white/70">
            <TagList label="Assuntos proibidos" items={client.boundaries.prohibitedSubjects} />
            <TagList label="Palavras proibidas" items={client.boundaries.prohibitedWords} />
            <TagList label="Nunca revelar" items={client.boundaries.privateDetailsNeverReveal} />
            <ReadOnly
              label="Nunca gerar nudez"
              value={client.boundaries.neverGenerateNudity ? "Sim" : "Não"}
            />
          </div>
        ) : (
          <p className="text-sm text-white/45">Nenhum limite registrado.</p>
        )}
      </Card>
    </section>
  );
}

function EmptyTab({ title, text }: { title: string; text: string }) {
  return (
    <Card title={title}>
      <p className="text-sm text-white/55">{text}</p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111115] p-6">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function ReadOnly({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "col-span-2" : ""}>
      <p className="text-xs font-semibold text-white/45">{label}</p>
      {multiline ? (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
          {value || "—"}
        </p>
      ) : (
        <p className="mt-1 text-sm text-white/80">{value || "—"}</p>
      )}
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/45">{label}</p>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/45">—</p>
      )}
    </div>
  );
}
