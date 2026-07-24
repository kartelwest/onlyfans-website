import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createUniqueModelSlug,
  getNextModelNumber,
} from "@/lib/models/createModelSlug";

const MAX_ACTIVE_MODELS = 30;

const VALID_STATUSES = ["active", "inactive", "candidate", "denied"] as const;
type ModelStatusValue = (typeof VALID_STATUSES)[number];

// Fields an assistant is allowed to change via update_model. Deliberately
// excludes slug/model_number/status/active/profile_id and anything tied to
// onboarding, payments or drive links — those have their own dedicated flows.
const UPDATABLE_FIELDS = [
  "display_name",
  "stage_name",
  "birthday",
  "nationality",
  "city",
  "language",
  "email",
  "whatsapp",
  "instagram",
  "twitter",
  "reddit",
  "tiktok",
  "youtube",
  "facebook",
  "onlyfans",
  "fansly",
] as const;
type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

export const MODEL_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_models",
    description:
      "Lista modelos cadastradas na agência, com filtro opcional por status. Use isso primeiro para encontrar o id ou slug de uma modelo antes de atualizá-la.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...VALID_STATUSES],
          description:
            "Filtra pelo status da modelo. Omita para listar todas.",
        },
        search: {
          type: "string",
          description:
            "Filtro opcional por nome (busca em display_name e stage_name).",
        },
        limit: {
          type: "number",
          description: "Número máximo de resultados (padrão 50, máximo 200).",
        },
      },
    },
  },
  {
    name: "add_model",
    description:
      "Cria um novo registro de modelo. Gera automaticamente o número e o slug da modelo.",
    input_schema: {
      type: "object",
      properties: {
        display_name: {
          type: "string",
          description: "Nome completo da modelo (obrigatório).",
        },
        stage_name: { type: "string", description: "Nome artístico." },
        birthday: {
          type: "string",
          description: "Data de nascimento no formato YYYY-MM-DD.",
        },
        city: { type: "string" },
        nationality: { type: "string" },
        email: { type: "string" },
        whatsapp: { type: "string" },
        instagram: { type: "string" },
        twitter: { type: "string" },
        status: {
          type: "string",
          enum: [...VALID_STATUSES],
          description:
            "Status inicial da modelo. Padrão 'candidate' se omitido.",
        },
      },
      required: ["display_name"],
    },
  },
  {
    name: "update_model",
    description:
      "Atualiza campos de informação de uma modelo existente (não altera status/ativação — use set_model_status para isso).",
    input_schema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "UUID da modelo. Informe isso ou slug.",
        },
        slug: {
          type: "string",
          description: "Slug da modelo. Informe isso ou model_id.",
        },
        fields: {
          type: "object",
          description:
            "Par chave/valor com os campos a atualizar. Chaves permitidas: " +
            UPDATABLE_FIELDS.join(", "),
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "set_model_status",
    description:
      "Altera o status de uma modelo (applicant/candidate, active, inactive, denied). Ao ativar, respeita o limite de 30 modelos ativas.",
    input_schema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "UUID da modelo. Informe isso ou slug.",
        },
        slug: {
          type: "string",
          description: "Slug da modelo. Informe isso ou model_id.",
        },
        status: {
          type: "string",
          enum: [...VALID_STATUSES],
        },
      },
      required: ["status"],
    },
  },
];

export type ModelToolName =
  | "list_models"
  | "add_model"
  | "update_model"
  | "set_model_status";

type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

async function resolveModelId(
  supabase: SupabaseClient,
  input: { model_id?: string; slug?: string },
): Promise<{ id: string } | { error: string }> {
  if (input.model_id) {
    return { id: input.model_id };
  }

  if (input.slug) {
    const { data, error } = await supabase
      .from("models")
      .select("id")
      .eq("slug", input.slug)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return { error: `Nenhuma modelo encontrada com slug "${input.slug}".` };
    }

    return { id: data.id };
  }

  return { error: "Informe model_id ou slug." };
}

export async function executeModelTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  switch (toolName as ModelToolName) {
    case "list_models":
      return listModels(supabase, toolInput);
    case "add_model":
      return addModel(supabase, toolInput);
    case "update_model":
      return updateModel(supabase, toolInput);
    case "set_model_status":
      return setModelStatus(supabase, toolInput);
    default:
      return { ok: false, error: `Ferramenta desconhecida: ${toolName}` };
  }
}

async function listModels(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const status =
    typeof input.status === "string" &&
    VALID_STATUSES.includes(input.status as ModelStatusValue)
      ? (input.status as ModelStatusValue)
      : undefined;

  const search = typeof input.search === "string" ? input.search.trim() : "";

  const limit = Math.min(
    typeof input.limit === "number" && input.limit > 0 ? input.limit : 50,
    200,
  );

  let query = supabase
    .from("models")
    .select(
      "id, model_number, slug, display_name, stage_name, status, active, city, whatsapp, email, instagram, created_at",
    )
    .order("model_number", { ascending: true })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(
      `display_name.ilike.%${search}%,stage_name.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

async function addModel(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const displayName =
    typeof input.display_name === "string" ? input.display_name.trim() : "";

  if (!displayName) {
    return { ok: false, error: "display_name é obrigatório." };
  }

  const status =
    typeof input.status === "string" &&
    VALID_STATUSES.includes(input.status as ModelStatusValue)
      ? (input.status as ModelStatusValue)
      : "candidate";

  if (status === "active") {
    const { count, error: countError } = await supabase
      .from("models")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    if (countError) {
      return { ok: false, error: countError.message };
    }

    if ((count ?? 0) >= MAX_ACTIVE_MODELS) {
      return {
        ok: false,
        error:
          "Não é possível criar como ativa: o limite de 30 modelos ativas já foi atingido.",
      };
    }
  }

  const stageName =
    typeof input.stage_name === "string" && input.stage_name.trim()
      ? input.stage_name.trim()
      : null;

  const slug = await createUniqueModelSlug(
    supabase,
    stageName || displayName,
  );

  const modelNumber = await getNextModelNumber(supabase);

  const insertPayload: Record<string, unknown> = {
    model_number: modelNumber,
    slug,
    display_name: displayName,
    stage_name: stageName,
    status,
    active: status === "active",
    latest_note_summary: "Criada pelo assistente Claude no admin.",
  };

  for (const field of [
    "birthday",
    "city",
    "nationality",
    "email",
    "whatsapp",
    "instagram",
    "twitter",
  ] as const) {
    const value = input[field];

    if (typeof value === "string" && value.trim()) {
      insertPayload[field] = value.trim();
    }
  }

  const { data, error } = await supabase
    .from("models")
    .insert(insertPayload)
    .select("id, slug, model_number, display_name, status")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

async function updateModel(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const resolved = await resolveModelId(supabase, input as never);

  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }

  const fields = input.fields;

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return { ok: false, error: "fields deve ser um objeto." };
  }

  const updatePayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    fields as Record<string, unknown>,
  )) {
    if (!UPDATABLE_FIELDS.includes(key as UpdatableField)) {
      return {
        ok: false,
        error: `Campo não permitido: "${key}". Campos permitidos: ${UPDATABLE_FIELDS.join(", ")}.`,
      };
    }

    updatePayload[key] = value;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { ok: false, error: "Nenhum campo válido para atualizar." };
  }

  const { data, error } = await supabase
    .from("models")
    .update(updatePayload)
    .eq("id", resolved.id)
    .select("id, slug, display_name")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

async function setModelStatus(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const resolved = await resolveModelId(supabase, input as never);

  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }

  const status = input.status;

  if (
    typeof status !== "string" ||
    !VALID_STATUSES.includes(status as ModelStatusValue)
  ) {
    return { ok: false, error: "status inválido." };
  }

  const willBeActive = status === "active";

  if (willBeActive) {
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("active")
      .eq("id", resolved.id)
      .maybeSingle();

    if (modelError) {
      return { ok: false, error: modelError.message };
    }

    if (!model) {
      return { ok: false, error: "Modelo não encontrada." };
    }

    if (!model.active) {
      const { count, error: countError } = await supabase
        .from("models")
        .select("id", { count: "exact", head: true })
        .eq("active", true);

      if (countError) {
        return { ok: false, error: countError.message };
      }

      if ((count ?? 0) >= MAX_ACTIVE_MODELS) {
        return {
          ok: false,
          error:
            "Você atingiu o máximo de 30 modelos ativas. Inative outra modelo primeiro.",
        };
      }
    }
  }

  const { data, error } = await supabase
    .from("models")
    .update({ status, active: willBeActive })
    .eq("id", resolved.id)
    .select("id, slug, display_name, status, active")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}
