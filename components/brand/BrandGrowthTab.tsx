"use client";

import { useState } from "react";
import Link from "next/link";
import type { Model } from "@/types/model";

export default function BrandGrowthTab({ model }: { model: Model }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleEnroll() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/brand/enroll-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id }),
      });

      const result = (await res.json()) as { error?: string };
      if (!res.ok || result.error) {
        throw new Error(result.error ?? "Erro ao matricular.");
      }

      setMessage("Modelo matriculada no Brand Growth.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-pink-100">
          Brand Growth — Amplia
        </h2>

        <p className="mt-4 text-sm text-white/60">
          Matricule esta modelo no serviço de Brand Growth para gerenciar Instagram e X/Twitter de forma assistida.
        </p>

        {message && (
          <div className="mt-4 rounded-xl border border-pink-400/30 bg-pink-500/10 p-4 text-sm text-pink-200">
            {message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleEnroll}
            disabled={loading}
            className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-60"
          >
            {loading ? "Matriculando..." : "Matricular em Brand Growth"}
          </button>

          <Link
            href="/admin/amplia/models"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
          >
            Ver clientes Amplia
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-pink-100">
          Status
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          <li>Instagram: em lançamento</li>
          <li>X / Twitter: manual (API off)</li>
          <li>Conteúdo gerado por IA: manual</li>
        </ul>
      </div>
    </section>
  );
}
