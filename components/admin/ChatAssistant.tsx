"use client";

import { FormEvent, useState } from "react";

type ChatAction = {
  tool: string;
  input: unknown;
  result: { ok: boolean; data?: unknown; error?: string };
};

type DisplayMessage = {
  role: "user" | "assistant";
  text: string;
  actions?: ChatAction[];
};

const TOOL_LABELS: Record<string, string> = {
  list_models: "Consultou a lista de modelos",
  add_model: "Criou uma modelo",
  update_model: "Atualizou uma modelo",
  set_model_status: "Alterou o status de uma modelo",
};

export default function ChatAssistant() {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>(
    [],
  );
  // Raw Anthropic message history (text + tool_use + tool_result blocks),
  // kept opaque here and just echoed back on each request so the server can
  // continue the same conversation.
  const [apiMessages, setApiMessages] = useState<unknown[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isSending) {
      return;
    }

    setError("");
    setInput("");
    setIsSending(true);

    const nextApiMessages = [
      ...apiMessages,
      { role: "user", content: text },
    ];

    setDisplayMessages((current) => [
      ...current,
      { role: "user", text },
    ]);

    try {
      const response = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextApiMessages }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível falar com o assistente.",
        );
      }

      setApiMessages(result.messages ?? nextApiMessages);

      setDisplayMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.reply,
          actions: result.actions,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/10 bg-[#111115]">
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {displayMessages.length === 0 && (
          <p className="text-sm text-white/45">
            Peça em português, por exemplo: &ldquo;adicione uma modelo nova
            chamada Jane Doe, cidade Miami, status candidata&rdquo; ou
            &ldquo;liste as modelos ativas&rdquo;.
          </p>
        )}

        {displayMessages.map((message, index) => (
          <div
            key={index}
            className={`rounded-xl px-4 py-3 text-sm leading-6 ${
              message.role === "user"
                ? "ml-auto max-w-[80%] bg-pink-500/20 text-pink-100"
                : "mr-auto max-w-[85%] bg-white/5 text-white/85"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.text}</p>

            {message.actions && message.actions.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
                {message.actions.map((action, actionIndex) => (
                  <p
                    key={actionIndex}
                    className={`text-xs ${
                      action.result.ok
                        ? "text-emerald-300/80"
                        : "text-red-300/80"
                    }`}
                  >
                    {action.result.ok ? "✓" : "✗"}{" "}
                    {TOOL_LABELS[action.tool] ?? action.tool}
                    {!action.result.ok && action.result.error
                      ? `: ${action.result.error}`
                      : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <p className="mr-auto text-sm text-white/45">Pensando...</p>
        )}
      </div>

      {error && (
        <p className="border-t border-red-400/20 bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-300">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-t border-white/10 p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Digite um pedido para o assistente..."
          disabled={isSending}
          className="flex-1 rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none transition focus:border-pink-400/60 disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
