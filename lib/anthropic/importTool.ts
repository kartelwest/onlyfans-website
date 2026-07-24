import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODEL, getAnthropicApiKey } from "@/lib/anthropic/config";

// Mirrors the exact field names collected by the public /aplicar form
// (see app/aplicar/page.tsx's FormState) so extracted data maps 1:1 onto it.
export type ExtractedApplicant = {
  nomeCompleto: string;
  nomeArtisticoDesejado?: string;
  dataNascimento?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  twitter?: string;
  representanteIndicacao?: string;
  possuiOnlyfans?: string;
  bloquearBrasil?: string;
  mostrarRosto?: string;
  moedaPreferida?: string;
  frequenciaConteudo?: string;
  motivoCandidatura?: string;
};

export type ExtractionResult = {
  applicants: ExtractedApplicant[];
  clarification_needed: string | null;
};

export type UploadedFile = {
  base64Data: string;
  mediaType: string;
};

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_extracted_applicants",
  description:
    "Registra os dados de candidata(s) extraídos dos arquivos enviados, usando exatamente os campos do formulário /aplicar.",
  input_schema: {
    type: "object",
    properties: {
      applicants: {
        type: "array",
        description:
          "Normalmente um único item — todos os arquivos enviados juntos representam a MESMA candidata, a menos que o conteúdo deixe claro que são pessoas diferentes.",
        items: {
          type: "object",
          properties: {
            nomeCompleto: { type: "string", description: "Nome completo." },
            nomeArtisticoDesejado: { type: "string" },
            dataNascimento: {
              type: "string",
              description:
                "Data de nascimento no formato YYYY-MM-DD, apenas se estiver EXPLICITAMENTE escrita no arquivo. Nunca calcule isso a partir de uma idade.",
            },
            cidade: { type: "string" },
            estado: { type: "string" },
            pais: { type: "string" },
            whatsapp: { type: "string" },
            email: { type: "string" },
            instagram: { type: "string" },
            twitter: { type: "string" },
            representanteIndicacao: {
              type: "string",
              enum: ["Kartel", "Rayssa", "Antonio (Tony)", "Boca a boca"],
              description: "Quem indicou a candidata, se mencionado.",
            },
            possuiOnlyfans: {
              type: "string",
              enum: ["sim", "nao"],
              description: "Se a candidata já possui conta no OnlyFans.",
            },
            bloquearBrasil: {
              type: "string",
              enum: ["sim", "nao", "nao_sei"],
              description: "Se deseja bloquear o Brasil de ver seu conteúdo.",
            },
            mostrarRosto: {
              type: "string",
              enum: ["sim", "nao", "depende"],
              description: "Se está confortável em mostrar o rosto.",
            },
            moedaPreferida: {
              type: "string",
              enum: ["real", "dolar"],
              description: "Moeda preferida para receber pagamentos.",
            },
            frequenciaConteudo: {
              type: "string",
              description: "Com que frequência pode produzir conteúdo.",
            },
            motivoCandidatura: {
              type: "string",
              description: "Motivo pelo qual deseja entrar para a agência.",
            },
          },
          required: ["nomeCompleto"],
        },
      },
      clarification_needed: {
        type: ["string", "null"],
        description:
          "Preencha com uma pergunta clara em português apenas se não estiver certo se os arquivos pertencem a mais de uma candidata, ou se algum dado essencial for ambíguo. Caso contrário, use null.",
      },
    },
    required: ["applicants"],
  },
};

const SYSTEM_PROMPT = `Você extrai dados de candidatas a modelo de uma agência a partir de PDFs e/ou imagens
(formulários preenchidos, prints de conversa do WhatsApp, documentos, etc.) para
preencher o cadastro interno da agência.

REGRAS OBRIGATÓRIAS:
1. Você pode receber de 1 a 6 arquivos. Na grande maioria dos casos, TODOS os arquivos
   enviados juntos pertencem à MESMA candidata (por exemplo, vários prints de uma
   conversa de WhatsApp cortada em pedaços). Trate-os como uma única candidata e
   retorne um único item em "applicants", a menos que o conteúdo deixe claro que há
   mais de uma pessoa (por exemplo, dois documentos de identidade com nomes
   diferentes) — nesse caso, e apenas nesse caso, retorne um item por pessoa.
2. Extraia apenas os campos definidos na ferramenta. Ignore qualquer outra informação
   presente no arquivo que não corresponda a um desses campos (endereço residencial,
   links de fotos, números de documento, etc.) — não a armazene em lugar nenhum.
3. NUNCA invente um valor. Campo não encontrado no arquivo = simplesmente omita esse
   campo do resultado.
4. Regra crítica sobre data de nascimento: preencha "dataNascimento" SOMENTE se uma
   data de nascimento explícita estiver escrita no arquivo. Se o arquivo mostrar apenas
   uma IDADE (ex.: "25 anos") mas não uma data de nascimento, NÃO calcule nem estime uma
   data — deixe "dataNascimento" de fora completamente.
5. Se não tiver certeza sobre a divisão entre candidatas ou sobre algum dado essencial,
   preencha "clarification_needed" com uma pergunta objetiva em português em vez de
   adivinhar.`;

export async function extractApplicantsFromFiles(
  files: UploadedFile[],
): Promise<ExtractionResult> {
  const anthropic = new Anthropic({ apiKey: getAnthropicApiKey() });

  const fileBlocks: Anthropic.ContentBlockParam[] = files.map((file) => {
    if (file.mediaType === "application/pdf") {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: file.base64Data,
        },
      };
    }

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: file.mediaType as "image/jpeg" | "image/png" | "image/webp",
        data: file.base64Data,
      },
    };
  });

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_extracted_applicants" },
    messages: [
      {
        role: "user",
        content: [
          ...fileBlocks,
          {
            type: "text",
            text:
              files.length > 1
                ? `Estes ${files.length} arquivos pertencem à mesma candidata, a menos que o conteúdo indique claramente o contrário. Extraia os dados dela.`
                : "Extraia os dados da candidata deste arquivo.",
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
    applicants?: ExtractedApplicant[];
    clarification_needed?: string | null;
  };

  return {
    applicants: input.applicants ?? [],
    clarification_needed: input.clarification_needed ?? null,
  };
}
