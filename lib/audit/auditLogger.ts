import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ManagementRole } from "@/types/model";

export type AuditActor = {
  id: string;
  fullName: string;
  role: ManagementRole;
};

export type AuditEntry = {
  modelId: string;
  action: string;
  fieldName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  actor: AuditActor;
  source?: string | null;
  summary: string;
};

export type SystemAuditEntry = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  modelId?: string | null;
  previousValue?: unknown | null;
  newValue?: unknown | null;
  actor: AuditActor;
  source?: string | null;
  summary: string;
  impersonated?: { id: string; fullName: string } | null;
};

export type AuditLogResult = {
  error: Error | null;
};

const SENSITIVE_FIELDS = new Set([
  "password",
  "password_hash",
  "reset_token",
  "session_token",
  "api_key",
  "temporary_password",
]);

const MAX_VALUE_LENGTH = 2000;

function sanitizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const str = typeof value === "string" ? value : String(value);

  if (str.length > MAX_VALUE_LENGTH) {
    return str.slice(0, MAX_VALUE_LENGTH) + "…(truncado)";
  }

  return str;
}

function isSensitiveField(fieldName: string | null | undefined): boolean {
  if (!fieldName) {
    return false;
  }

  return SENSITIVE_FIELDS.has(fieldName.toLowerCase());
}

export async function logAuditEntry(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<AuditLogResult> {
  const fieldName = entry.fieldName ?? null;
  const isSensitive = isSensitiveField(fieldName);

  const previousValue = isSensitive
    ? null
    : sanitizeValue(entry.previousValue);

  const newValue = isSensitive
    ? null
    : sanitizeValue(entry.newValue);

  const { error } = await supabase
    .from("model_audit_history")
    .insert({
      model_id: entry.modelId,
      action: entry.action,
      field_name: fieldName,
      previous_value: previousValue,
      new_value: newValue,
      actor_id: entry.actor.id,
      actor_name: entry.actor.fullName,
      actor_role: entry.actor.role,
      source: entry.source ?? null,
      summary: entry.summary,
    });

  if (error) {
    console.error("Erro ao registrar histórico de auditoria:", error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function logAuditEntries(
  supabase: SupabaseClient,
  entries: AuditEntry[],
): Promise<AuditLogResult> {
  if (entries.length === 0) {
    return { error: null };
  }

  const rows = entries.map((entry) => {
    const fieldName = entry.fieldName ?? null;
    const isSensitive = isSensitiveField(fieldName);

    return {
      model_id: entry.modelId,
      action: entry.action,
      field_name: fieldName,
      previous_value: isSensitive
        ? null
        : sanitizeValue(entry.previousValue),
      new_value: isSensitive
        ? null
        : sanitizeValue(entry.newValue),
      actor_id: entry.actor.id,
      actor_name: entry.actor.fullName,
      actor_role: entry.actor.role,
      source: entry.source ?? null,
      summary: entry.summary,
    };
  });

  const { error } = await supabase
    .from("model_audit_history")
    .insert(rows);

  if (error) {
    console.error("Erro ao registrar histórico de auditoria (lote):", error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

function sanitizeJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return value.length > MAX_VALUE_LENGTH
      ? value.slice(0, MAX_VALUE_LENGTH) + "…(truncado)"
      : value;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  const str = JSON.stringify(value);
  return str.length > MAX_VALUE_LENGTH
    ? str.slice(0, MAX_VALUE_LENGTH) + "…(truncado)"
    : value;
}

export async function logSystemAuditEntry(
  supabase: SupabaseClient,
  entry: SystemAuditEntry,
): Promise<AuditLogResult> {
  const { error } = await supabase
    .from("system_audit_log")
    .insert({
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      target_name: entry.targetName ?? null,
      model_id: entry.modelId ?? null,
      previous_value: sanitizeJson(entry.previousValue),
      new_value: sanitizeJson(entry.newValue),
      actor_id: entry.actor.id,
      actor_name: entry.actor.fullName,
      actor_role: entry.actor.role,
      source: entry.source ?? null,
      summary: entry.summary,
      impersonated_user_id: entry.impersonated?.id ?? null,
      impersonated_user_name: entry.impersonated?.fullName ?? null,
    });

  if (error) {
    console.error("Erro ao registrar auditoria do sistema:", error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

const FIELD_LABELS: Record<string, string> = {
  stage_name: "Nome artístico",
  birthday: "Data de nascimento",
  email: "E-mail",
  whatsapp: "WhatsApp",
  nationality: "Nacionalidade",
  city: "Cidade",
  language: "Idioma",
  instagram: "Instagram",
  twitter: "Twitter",
  reddit: "Reddit",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  onlyfans: "OnlyFans",
  fansly: "Fansly",
  drive_onlyfans: "Drive OnlyFans",
  drive_instagram: "Google Drive / Instagram",
  drive_twitter: "Drive Twitter",
  content_drive_url: "Google Drive / Conteúdo",
  preferred_currency: "Moeda",
  country_code: "País",
  expenses_enabled: "Lançamentos de despesas e empréstimos",
  ledger_entry: "Lançamento",
  deduct_on: "Data de desconto",
  monthly_earnings: "Ganhos mensais",
  content_frequency: "Frequência de conteúdo",
  referral_source: "Origem da indicação",
  block_brazil: "Bloquear Brasil",
  show_face: "Mostrar rosto",
  full_name: "Nome completo",
  active: "Status ativo",
  status: "Status da conta",
  profile_photo_url: "Foto de perfil",
  representative_id: "Representante atribuído",
  role: "Função",
  must_change_password: "Precisa alterar senha",
  website_login_enabled: "Acesso ao site",
  onboarding_percentage: "Progresso do onboarding",
  onboarding_complete: "Onboarding completo",
  proxy_ip: "IP do proxy",
  proxy_company: "Empresa do proxy",
  proxy_company_other: "Outra empresa do proxy",
  proxy_country: "País do proxy",
  instagram_marketing: "Conta de marketing Instagram",
  twitter_marketing: "Conta de marketing Twitter",
  model_number: "Número da modelo",
  slug: "Slug",
  display_name: "Nome de exibição",
};

export function getFieldLabel(fieldName: string | null): string {
  if (!fieldName) {
    return "Campo";
  }

  return FIELD_LABELS[fieldName] ?? fieldName;
}
