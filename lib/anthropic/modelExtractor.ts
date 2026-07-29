import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  normalizeExtractedModelData,
  type NormalizedModelFields,
} from "@/lib/admin/modelOnboardingHelpers";
import { CLAUDE_MODEL, getAnthropicApiKey } from "@/lib/anthropic/config";

type RawExtractedModelData = {
  fullName?: string | null;
  stageName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  country?: string | null;
  unmapped?: (string | null)[];
  missing?: (string | null)[];
};

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_model_onboarding",
  description:
    "Extrai informações de uma modelo a partir de um texto não estruturado e as organiza nos campos aprovados do cadastro.",
  input_schema: {
    type: "object",
    properties: {
      fullName: {
        type: ["string", "null"],
        description: "Nome completo. Não invente. Use null se não encontrado.",
      },
      stageName: {
        type: ["string", "null"],
        description:
          "Nome artístico ou profissional. Use null se não houver.",
      },
      email: {
        type: ["string", "null"],
        description: "Endereço de e-mail. Use null se não encontrado.",
      },
      phone: {
        type: ["string", "null"],
        description:
          "Número de telefone/WhatsApp, incluindo código do país quando presente. Use null se não encontrado.",
      },
      dateOfBirth: {
        type: ["string", "null"],
        description:
          'Data de nascimento EXPLICITAMENTE escrita no texto no formato "YYYY-MM-DD" ou "DD/MM/AAAA". NUNCA calcule a partir de uma idade. Use null se não houver data explícita ou se for ambígua.',
      },
      country: {
        type: ["string", "null"],
        description:
          "País. Normalize para 'Brasil' se o texto indicar Brasil. Use null se não encontrado.",
      },
      unmapped: {
        type: "array",
        description:
          "Lista curta de informações presentes no texto que NÃO se encaixam em nenhum campo aprovado. Ex.: 'número do RG', 'endereço', 'nome da mãe'. Deixe vazio se não houver.",
        items: { type: "string" },
      },
      missing: {
        type: "array",
        description:
          "Lista dos campos aprovados que não foram encontrados no texto. Use apenas os nomes: fullName, stageName, email, phone, dateOfBirth, country.",
        items: {
          type: "string",
          enum: [
            "fullName",
            "stageName",
            "email",
            "phone",
            "dateOfBirth",
            "country",
          ],
        },
      },
    },
    required: ["unmapped", "missing"],
  },
};

const SYSTEM_PROMPT = `Você extrai dados de cadastro de uma modelo para a agência KARAY Models a partir de um texto não estruturado.

CAMPOS APROVADOS (extraia APENAS estes):
- Nome completo (fullName)
- Nome artístico (stageName)
- E-mail (email)
- Telefone/WhatsApp (phone)
- Data de nascimento (dateOfBirth)
- País (country)

REGRAS OBRIGATÓRIAS:
1. NUNCA invente um valor. Se não estiver no texto, use null.
2. NUNCA calcule a data de nascimento a partir de uma idade. Só preencha dateOfBirth se uma data estiver explicitamente escrita.
3. Normalize o país para "Brasil" quando o texto indicar Brasil (Brasil, Brazil, BR, etc.).
4. Preserve acentos e maiúsculas em nomes.
5. Não mapeie informações como RG, CPF, endereço, redes sociais, links de fotos, nome de banco, etc. Coloque essas informações em "unmapped".
6. Se houver dois valores diferentes para o mesmo campo no texto (conflito), não escolha um: use null para esse campo e inclua o nome do campo em "missing".
7. O papel do usuário deve permanecer "model". Nunca mude a role, permissões ou conceda acesso de admin/representante.
8. Se houver ambiguidade na data (por exemplo, 02/03/1990 sem contexto claro), use null e inclua "dateOfBirth" em "missing".`;

export async function extractModelData(
  rawText: string,
): Promise<NormalizedModelFields & { unmapped: string[]; missing: string[] }> {
  const anthropic = new Anthropic({
    apiKey: getAnthropicApiKey(),
  });

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_model_onboarding" },
    messages: [
      {
        role: "user",
        content: rawText,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("Claude não retornou dados estruturados.");
  }

  const rawInput = toolUse.input as RawExtractedModelData;

  const normalized = normalizeExtractedModelData({
    fullName: rawInput.fullName,
    stageName: rawInput.stageName,
    email: rawInput.email,
    phone: rawInput.phone,
    dateOfBirth: rawInput.dateOfBirth,
    country: rawInput.country,
  });

  const unmapped = (rawInput.unmapped ?? [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);

  const missingFromClaude = new Set(
    (rawInput.missing ?? [])
      .filter((item): item is string => typeof item === "string")
      .filter((item) => item.length > 0),
  );

  if (!normalized.fullName) missingFromClaude.add("fullName");
  if (!normalized.stageName) missingFromClaude.add("stageName");
  if (!normalized.emailValid) missingFromClaude.add("email");
  if (!normalized.phoneValid) missingFromClaude.add("phone");
  if (!normalized.dateOfBirth || normalized.dateAmbiguous) {
    missingFromClaude.add("dateOfBirth");
  }
  if (!normalized.country) missingFromClaude.add("country");

  return {
    ...normalized,
    unmapped,
    missing: Array.from(missingFromClaude),
  };
}
