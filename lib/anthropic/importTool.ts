import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODEL, getAnthropicApiKey } from "@/lib/anthropic/config";

export type ExtractedModel = {
  display_name: string;
  stage_name?: string;
  birthday?: string;
  city?: string;
  state?: string;
  country?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  twitter?: string;
  notes?: string;
};

export type ExtractionResult = {
  models: ExtractedModel[];
  clarification_needed: string | null;
};

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_extracted_models",
  description:
    "Registra os dados de modelo(s) extraídos do documento/imagem enviado.",
  input_schema: {
    type: "object",
    properties: {
      models: {
        type: "array",
        description:
          "Um item por modelo encontrada no arquivo. Se o arquivo contiver dados de apenas uma pessoa, retorne um único item.",
        items: {
          type: "object",
          properties: {
            display_name: { type: "string" },
            stage_name: { type: "string" },
            birthday: {
              type: "string",
              description: "Data de nascimento no formato YYYY-MM-DD, se disponível.",
            },
            city: { type: "string" },
            state: { type: "string" },
            country: { type: "string" },
            whatsapp: { type: "string" },
            email: { type: "string" },
            instagram: { type: "string" },
            twitter: { type: "string" },
            notes: {
              type: "string",
              description:
                "Qualquer outra informação relevante do documento que não se encaixe nos campos acima.",
            },
          },
          required: ["display_name"],
        },
      },
      clarification_needed: {
        type: ["string", "null"],
        description:
          "Preencha com uma pergunta clara em português se não estiver certo de quantas modelos existem no arquivo ou se algum dado essencial for ambíguo. Caso contrário, use null.",
      },
    },
    required: ["models"],
  },
};

const SYSTEM_PROMPT = `Você extrai dados cadastrais de modelos de agência a partir de PDFs ou imagens
(formulários preenchidos, prints de conversa, documentos de identidade, etc). Extraia
apenas o que estiver realmente presente no arquivo — nunca invente valores. Se o
arquivo tiver múltiplas páginas ou mencionar mais de uma pessoa, retorne um item por
modelo em "models". Se não tiver certeza sobre a divisão entre modelos ou sobre algum
dado importante, preencha "clarification_needed" com uma pergunta objetiva em vez de
adivinhar.`;

export async function extractModelsFromFile(
  base64Data: string,
  mediaType: string,
): Promise<ExtractionResult> {
  const anthropic = new Anthropic({ apiKey: getAnthropicApiKey() });

  const isPdf = mediaType === "application/pdf";

  const fileBlock: Anthropic.ContentBlockParam = isPdf
    ? {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data,
        },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
          data: base64Data,
        },
      };

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_extracted_models" },
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: "Extraia os dados de modelo(s) deste arquivo.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("O assistente não retornou dados extraídos.");
  }

  const input = toolUse.input as {
    models?: ExtractedModel[];
    clarification_needed?: string | null;
  };

  return {
    models: input.models ?? [],
    clarification_needed: input.clarification_needed ?? null,
  };
}
