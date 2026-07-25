"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AmpliaLayout } from "@/components/amplia/AmpliaLayout";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X / Twitter" },
];

const CONTENT_TYPES = [
  { value: "feed_image", label: "Feed — Imagem" },
  { value: "feed_carousel", label: "Feed — Carrossel" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "x_post", label: "X Post" },
  { value: "x_thread", label: "X Thread" },
];

export const dynamic = "force-dynamic";

export default function GerarConteudoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    caption: string;
    hashtags: string[];
    body: string;
    cta: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      talentId: String(formData.get("talentId")),
      platform: String(formData.get("platform")),
      contentType: String(formData.get("contentType")),
      objective: String(formData.get("objective")),
      pillar: String(formData.get("pillar")),
      language: String(formData.get("language")),
      dailyDirective: String(formData.get("dailyDirective")),
    };

    try {
      const res = await fetch("/api/brand/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        caption?: string;
        hashtags?: string[];
        body?: string;
        cta?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Erro ao gerar conteúdo.");
      }

      setResult({
        caption: data.caption ?? "",
        hashtags: data.hashtags ?? [],
        body: data.body ?? "",
        cta: data.cta ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AmpliaLayout
      title="Gerar conteúdo"
      actions={
        <button
          type="button"
          onClick={() => router.push("/amplia/conteudo")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10"
        >
          ← Voltar
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-[#111115] p-6">
          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <Field label="ID do cliente *" name="talentId" required />

          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Plataforma *" name="platform" options={PLATFORMS} required />
            <Select label="Tipo de conteúdo *" name="contentType" options={CONTENT_TYPES} required />
          </div>

          <Field label="Objetivo" name="objective" />
          <Field label="Pilar de conteúdo" name="pillar" />
          <Field label="Idioma" name="language" defaultValue="pt-BR" />
          <Field label="Diretriz do dia" name="dailyDirective" />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-60"
            >
              {loading ? "Gerando..." : "Gerar com IA"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-white/10 bg-[#111115] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-pink-100">
            Resultado
          </h2>

          {result ? (
            <div className="mt-4 space-y-4 text-sm text-white/80">
              <div>
                <p className="text-xs uppercase text-white/40">Caption / Post</p>
                <p className="mt-1 whitespace-pre-wrap">{result.caption}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-white/40">Hashtags</p>
                <p className="mt-1">{result.hashtags.map((h) => `#${h}`).join(" ")}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-white/40">CTA</p>
                <p className="mt-1">{result.cta}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-white/40">Body / Thread</p>
                <p className="mt-1 whitespace-pre-wrap">{result.body}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/50">Preencha o formulário e gere o primeiro conteúdo.</p>
          )}
        </div>
      </div>
    </AmpliaLayout>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-white/70">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-[#1a1a1f] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-white/70">
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-[#1a1a1f] px-4 py-3 text-sm text-white outline-none focus:border-pink-400/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
