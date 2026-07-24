import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, getAnthropicApiKey } from "@/lib/anthropic/config";
import { MODEL_TOOLS, executeModelTool } from "@/lib/anthropic/modelTools";
import type { ManagementRole } from "@/types/model";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é o assistente administrativo da agência Karay Models.
Você ajuda o proprietário/administrador a gerenciar o cadastro de modelos usando as
ferramentas disponíveis (list_models, add_model, update_model, set_model_status).

Regras importantes:
- Sempre que o pedido se referir a uma modelo pelo nome, use list_models para
  encontrar o id/slug correto antes de chamar update_model ou set_model_status.
- Nunca invente um id ou slug.
- Depois de executar uma ação, confirme em português exatamente o que foi feito
  (nome da modelo, campo alterado, novo status, etc.).
- Se um pedido for ambíguo (por exemplo, mais de uma modelo com nome parecido),
  pergunte para o usuário em vez de adivinhar.
- Se uma ferramenta retornar erro, explique o erro claramente e não tente
  disfarçar como sucesso.`;

const MAX_TOOL_ITERATIONS = 6;

type ChatBody = {
  messages?: Anthropic.MessageParam[];
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 403 });
    }

    const role = profile.role as ManagementRole;

    if (role !== "owner" && role !== "administrator") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const body = (await request.json()) as ChatBody;

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Envie ao menos uma mensagem." },
        { status: 400 },
      );
    }

    const anthropic = new Anthropic({ apiKey: getAnthropicApiKey() });

    const messages: Anthropic.MessageParam[] = [...body.messages];
    const actionsTaken: { tool: string; input: unknown; result: unknown }[] =
      [];

    let finalText = "";

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: MODEL_TOOLS,
        messages,
      });

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );
      finalText = textBlocks.map((block) => block.text).join("\n");

      if (response.stop_reason !== "tool_use") {
        break;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeModelTool(
          toolUse.name,
          (toolUse.input as Record<string, unknown>) ?? {},
          supabase,
        );

        actionsTaken.push({
          tool: toolUse.name,
          input: toolUse.input,
          result,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
          is_error: !result.ok,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      reply: finalText || "Ação concluída.",
      actions: actionsTaken,
      messages,
    });
  } catch (error) {
    console.error("Erro no assistente Claude:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao conversar com o assistente.",
      },
      { status: 500 },
    );
  }
}
