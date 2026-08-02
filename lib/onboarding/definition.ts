/**
 * The OnlyFans onboarding checklist — the single source of truth.
 *
 * Everything else derives from this file: the rows seeded into
 * `public.model_onboarding_items`, the checkboxes and fill-in boxes rendered
 * under the "Status" tab, and the percentages shown to admins and reps. To
 * change the process, change `ONBOARDING_SECTIONS` at the bottom; nothing
 * else needs touching.
 *
 * Two rules keep the seeding safe:
 *
 *   1. `key` values are permanent. A row in `model_onboarding_items` is
 *      matched by (model_id, platform, item_key), so renaming a key orphans
 *      whatever progress was recorded against it. Titles and descriptions can
 *      be reworded freely — only keys are load-bearing.
 *   2. A field marked `linked` is NOT stored on the checklist row. It reads
 *      and writes the column that already holds that value elsewhere in the
 *      app, so filling it in here fills it in there, and editing it there
 *      shows up here. Unlinked fields live in the row's `field_values` JSON.
 */

export const ONBOARDING_PLATFORM = "onlyfans";

export type OnboardingResponsibility = "model" | "agency" | "both";

export type OnboardingFieldType =
  | "text"
  | "textarea"
  | "url"
  | "email"
  | "tel"
  | "date"
  | "select";

/**
 * Every column the checklist is allowed to write through
 * `public.set_onboarding_linked_field`. This list is mirrored by the
 * allowlist inside that function — adding a key here without adding it there
 * makes the field fail to save, by design: the database, not the UI, decides
 * what the checklist may touch.
 */
export const LINKED_FIELDS = {
  stage_name: { label: "Nome artístico", location: "Resumo" },
  birthday: { label: "Data de nascimento", location: "Resumo" },
  email: { label: "E-mail", location: "Resumo" },
  whatsapp: { label: "WhatsApp", location: "Resumo" },
  nationality: { label: "Nacionalidade", location: "Resumo" },
  city: { label: "Cidade", location: "Resumo" },
  language: { label: "Idioma", location: "Resumo" },
  country_code: { label: "País (ISO)", location: "Resumo" },
  preferred_currency: { label: "Moeda", location: "Resumo" },
  content_frequency: { label: "Frequência de conteúdo", location: "Resumo" },
  referral_source: { label: "Como nos conheceu", location: "Resumo" },

  onlyfans: { label: "OnlyFans", location: "Aba OnlyFans" },
  fansly: { label: "Fansly", location: "Aba Fansly" },
  instagram: { label: "Instagram", location: "Aba Plataformas" },
  twitter: { label: "X / Twitter", location: "Aba Plataformas" },
  reddit: { label: "Reddit", location: "Aba Plataformas" },
  tiktok: { label: "TikTok", location: "Aba Plataformas" },
  youtube: { label: "YouTube", location: "Aba Plataformas" },
  facebook: { label: "Facebook", location: "Aba Plataformas" },

  drive_onlyfans: { label: "Drive — OnlyFans", location: "Aba Google Drive" },
  drive_instagram: { label: "Drive — Instagram", location: "Aba Google Drive" },
  drive_twitter: { label: "Drive — X / Twitter", location: "Aba Google Drive" },
  content_drive_url: { label: "Pasta de conteúdo", location: "Aba Google Drive" },

  pix_key: { label: "Chave PIX", location: "Aba Pagamentos" },
  pix_type: { label: "Tipo de chave PIX", location: "Aba Pagamentos" },
  bank_name: { label: "Banco", location: "Aba Pagamentos" },
  bank_agency: { label: "Agência", location: "Aba Pagamentos" },
  bank_account: { label: "Conta", location: "Aba Pagamentos" },
  account_holder_name: { label: "Titular da conta", location: "Aba Pagamentos" },
  account_holder_cpf: { label: "CPF do titular", location: "Aba Pagamentos" },
  payment_frequency: { label: "Frequência de pagamento", location: "Aba Pagamentos" },
} as const;

export type LinkedFieldKey = keyof typeof LINKED_FIELDS;

export function isLinkedFieldKey(value: string): value is LinkedFieldKey {
  return Object.prototype.hasOwnProperty.call(LINKED_FIELDS, value);
}

export type OnboardingField = {
  /** Unique within its item. Doubles as the `field_values` JSON key. */
  key: string;
  label: string;
  type: OnboardingFieldType;
  placeholder?: string;
  /** Options for `type: "select"`. */
  options?: string[];
  /**
   * The step cannot be checked off until every required field has a value.
   * This is what makes a fill-in box count towards the percentage rather than
   * being decorative.
   */
  required?: boolean;
  /**
   * When set, the value lives in that shared column instead of on the
   * checklist row — see the file header.
   */
  linked?: LinkedFieldKey;
};

export type OnboardingItem = {
  /** Permanent. See the file header. */
  key: string;
  title: string;
  description?: string;
  responsibility: OnboardingResponsibility;
  fields?: OnboardingField[];
};

export type OnboardingSection = {
  /** Permanent, same reasoning as item keys. */
  key: string;
  title: string;
  items: OnboardingItem[];
};

// ---------------------------------------------------------------------------
// The checklist
// ---------------------------------------------------------------------------

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    key: "model_info",
    title: "Informações da modelo",
    items: [
      {
        key: "personal_details",
        title: "Dados pessoais confirmados",
        description:
          "Nome completo, nome artístico e data de nascimento conferidos com o documento.",
        responsibility: "model",
        fields: [
          {
            key: "stage_name",
            label: "Nome artístico",
            type: "text",
            required: true,
            linked: "stage_name",
          },
          {
            key: "birthday",
            label: "Data de nascimento",
            type: "date",
            required: true,
            linked: "birthday",
          },
        ],
      },
      {
        key: "contact_details",
        title: "Contato confirmado",
        description: "E-mail e WhatsApp ativos, testados pelo responsável.",
        responsibility: "model",
        fields: [
          {
            key: "email",
            label: "E-mail",
            type: "email",
            required: true,
            linked: "email",
          },
          {
            key: "whatsapp",
            label: "WhatsApp",
            type: "tel",
            required: true,
            linked: "whatsapp",
          },
        ],
      },
      {
        key: "location_details",
        title: "Localização e idioma",
        description: "Define fuso, moeda de pagamento e idioma de atendimento.",
        responsibility: "model",
        fields: [
          { key: "city", label: "Cidade", type: "text", linked: "city" },
          {
            key: "nationality",
            label: "Nacionalidade",
            type: "text",
            linked: "nationality",
          },
          { key: "language", label: "Idioma", type: "text", linked: "language" },
        ],
      },
      {
        key: "welcome_call",
        title: "Chamada de boas-vindas realizada",
        description: "Reunião inicial de alinhamento concluída com a modelo.",
        responsibility: "both",
        fields: [
          { key: "call_date", label: "Data da chamada", type: "date" },
          { key: "call_notes", label: "Observações", type: "textarea" },
        ],
      },
    ],
  },

  {
    key: "documents",
    title: "Documentos legais",
    items: [
      {
        key: "identity_document",
        title: "Documento de identidade recebido",
        description: "Passaporte, RG ou CNH válido, dentro da validade.",
        responsibility: "model",
        fields: [
          {
            key: "document_type",
            label: "Tipo de documento",
            type: "select",
            options: ["RG", "CNH", "Passaporte"],
            required: true,
          },
          { key: "document_number", label: "Número", type: "text" },
        ],
      },
      {
        key: "contract_signed",
        title: "Contrato da agência assinado",
        description: "Contrato assinado pelas duas partes e arquivado.",
        responsibility: "both",
        fields: [
          { key: "signed_at", label: "Data da assinatura", type: "date", required: true },
        ],
      },
      {
        key: "model_release",
        title: "Model release assinado",
        description: "Autorização de uso de imagem assinada e arquivada.",
        responsibility: "both",
        fields: [{ key: "signed_at", label: "Data da assinatura", type: "date" }],
      },
    ],
  },

  {
    key: "banking",
    title: "Configuração bancária",
    items: [
      {
        key: "pix",
        title: "Chave PIX cadastrada",
        description: "Chave conferida e validada com um envio de teste.",
        responsibility: "model",
        fields: [
          {
            key: "pix_type",
            label: "Tipo de chave",
            type: "select",
            options: ["CPF", "E-mail", "Telefone", "Aleatória"],
            linked: "pix_type",
          },
          { key: "pix_key", label: "Chave PIX", type: "text", required: true, linked: "pix_key" },
        ],
      },
      {
        key: "bank_account",
        title: "Conta bancária cadastrada",
        description: "Banco, agência, conta e titular conferidos.",
        responsibility: "model",
        fields: [
          { key: "bank_name", label: "Banco", type: "text", required: true, linked: "bank_name" },
          { key: "bank_agency", label: "Agência", type: "text", linked: "bank_agency" },
          { key: "bank_account", label: "Conta", type: "text", linked: "bank_account" },
          {
            key: "account_holder_name",
            label: "Titular",
            type: "text",
            linked: "account_holder_name",
          },
          {
            key: "account_holder_cpf",
            label: "CPF do titular",
            type: "text",
            required: true,
            linked: "account_holder_cpf",
          },
        ],
      },
    ],
  },

  {
    key: "onlyfans_account",
    title: "Conta OnlyFans",
    items: [
      {
        key: "proxy_browser",
        title: "Proxy e navegador dedicados",
        description:
          "IP fixo e navegador exclusivo configurados antes de criar a conta.",
        responsibility: "agency",
      },
      {
        key: "account_created",
        title: "Conta criada",
        description: "Perfil criado no proxy dedicado, com e-mail da agência.",
        responsibility: "agency",
        fields: [
          { key: "onlyfans", label: "Perfil OnlyFans", type: "text", required: true, linked: "onlyfans" },
        ],
      },
      {
        key: "account_verified",
        title: "Conta verificada pelo OnlyFans",
        description: "Verificação de identidade aprovada pela plataforma.",
        responsibility: "both",
        fields: [{ key: "approved_at", label: "Data da aprovação", type: "date" }],
      },
      {
        key: "payout_linked",
        title: "Pagamento vinculado no OnlyFans",
        description: "Método de saque cadastrado e aprovado dentro da conta.",
        responsibility: "agency",
      },
      {
        key: "website_login",
        title: "Login do site criado",
        description: "Acesso individual à Área da Modelo entregue à modelo.",
        responsibility: "agency",
      },
    ],
  },

  {
    key: "profile_setup",
    title: "Otimização do perfil",
    items: [
      {
        key: "profile_media",
        title: "Foto de perfil e capa publicadas",
        responsibility: "agency",
      },
      {
        key: "bio_written",
        title: "Bio escrita",
        description: "Bio final aprovada pela modelo.",
        responsibility: "agency",
        fields: [{ key: "bio", label: "Bio publicada", type: "textarea" }],
      },
      {
        key: "pricing_set",
        title: "Preços definidos",
        description: "Assinatura, pacotes e valores de PPV configurados.",
        responsibility: "agency",
        fields: [
          { key: "subscription_price", label: "Assinatura mensal (USD)", type: "text" },
          { key: "bundles", label: "Pacotes", type: "text" },
        ],
      },
      {
        key: "welcome_message",
        title: "Mensagem de boas-vindas configurada",
        description: "Mensagem automática para novos assinantes.",
        responsibility: "agency",
        fields: [{ key: "message", label: "Mensagem", type: "textarea" }],
      },
      {
        key: "geoblock",
        title: "Bloqueio geográfico aplicado",
        description: "Países bloqueados conforme o pedido da modelo.",
        responsibility: "agency",
      },
    ],
  },

  {
    key: "drive",
    title: "Google Drive",
    items: [
      {
        key: "folders_created",
        title: "Pastas criadas e compartilhadas",
        description: "Uma pasta por plataforma, compartilhada com a modelo.",
        responsibility: "agency",
        fields: [
          {
            key: "drive_onlyfans",
            label: "Pasta OnlyFans",
            type: "url",
            required: true,
            linked: "drive_onlyfans",
          },
          {
            key: "drive_instagram",
            label: "Pasta Instagram",
            type: "url",
            linked: "drive_instagram",
          },
          {
            key: "drive_twitter",
            label: "Pasta X / Twitter",
            type: "url",
            linked: "drive_twitter",
          },
        ],
      },
      {
        key: "first_content",
        title: "Primeiro conteúdo recebido",
        description: "Fotos e vídeos iniciais entregues e revisados.",
        responsibility: "model",
        fields: [
          {
            key: "content_frequency",
            label: "Frequência combinada",
            type: "text",
            linked: "content_frequency",
          },
        ],
      },
    ],
  },

  {
    key: "social_accounts",
    title: "Redes sociais",
    items: [
      {
        key: "instagram",
        title: "Instagram configurado",
        responsibility: "agency",
        fields: [{ key: "instagram", label: "Perfil", type: "text", linked: "instagram" }],
      },
      {
        key: "twitter",
        title: "X / Twitter configurado",
        responsibility: "agency",
        fields: [{ key: "twitter", label: "Perfil", type: "text", linked: "twitter" }],
      },
      {
        key: "reddit",
        title: "Reddit configurado",
        responsibility: "agency",
        fields: [{ key: "reddit", label: "Perfil", type: "text", linked: "reddit" }],
      },
      {
        key: "tiktok",
        title: "TikTok configurado",
        responsibility: "agency",
        fields: [{ key: "tiktok", label: "Perfil", type: "text", linked: "tiktok" }],
      },
    ],
  },

  {
    key: "launch",
    title: "Lançamento e acompanhamento",
    items: [
      {
        key: "promo_plan",
        title: "Plano de divulgação definido",
        description: "Canais, frequência e responsáveis acordados.",
        responsibility: "agency",
        fields: [{ key: "plan", label: "Resumo do plano", type: "textarea" }],
      },
      {
        key: "first_post",
        title: "Primeira publicação feita",
        responsibility: "agency",
        fields: [{ key: "posted_at", label: "Data", type: "date" }],
      },
      {
        key: "first_subscriber",
        title: "Primeiro assinante conquistado",
        responsibility: "agency",
      },
      {
        key: "routine_review",
        title: "Rotina de acompanhamento combinada",
        description: "Frequência de relatórios e canal de contato definidos.",
        responsibility: "both",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export type FlatOnboardingItem = OnboardingItem & {
  sectionKey: string;
  sectionTitle: string;
  sectionOrder: number;
  itemOrder: number;
};

/** Every item, in display order, carrying its section coordinates. */
export function flattenOnboarding(): FlatOnboardingItem[] {
  return ONBOARDING_SECTIONS.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({
      ...item,
      sectionKey: section.key,
      sectionTitle: section.title,
      sectionOrder: sectionIndex + 1,
      itemOrder: itemIndex + 1,
    })),
  );
}

/**
 * The composite key stored in `model_onboarding_items.item_key`. Section and
 * item keys are combined so an item key only has to be unique inside its own
 * section.
 */
export function buildItemKey(sectionKey: string, itemKey: string): string {
  return `${sectionKey}.${itemKey}`;
}

const itemsByKey = new Map(
  flattenOnboarding().map((item) => [
    buildItemKey(item.sectionKey, item.key),
    item,
  ]),
);

export function findOnboardingItem(
  itemKey: string,
): FlatOnboardingItem | undefined {
  return itemsByKey.get(itemKey);
}

export function findOnboardingField(
  itemKey: string,
  fieldKey: string,
): OnboardingField | undefined {
  return findOnboardingItem(itemKey)?.fields?.find(
    (field) => field.key === fieldKey,
  );
}

export const ONBOARDING_ITEM_COUNT = itemsByKey.size;
