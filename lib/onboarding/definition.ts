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
  | "select"
  /** A tick box. Stored as the string "true", or absent when not ticked. */
  | "checkbox";

/** The stored value of a ticked checkbox field. */
export const CHECKBOX_TRUE = "true";

export function isCheckboxChecked(value: string | null | undefined): boolean {
  return value === CHECKBOX_TRUE;
}

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
  instagram_marketing: { label: "Instagram (Marketing)", location: "Aba Resumo" },
  twitter: { label: "X / Twitter", location: "Aba Plataformas" },
  reddit: { label: "Reddit", location: "Aba Plataformas" },
  tiktok: { label: "TikTok", location: "Aba Plataformas" },
  youtube: { label: "YouTube", location: "Aba Plataformas" },
  facebook: { label: "Facebook", location: "Aba Plataformas" },

  drive_onlyfans: { label: "Drive — OnlyFans", location: "Aba Google Drive" },
  drive_instagram: {
    label: "Google Drive / Instagram",
    location: "Resumo ou aba Google Drive",
  },
  drive_twitter: { label: "Drive — X / Twitter", location: "Aba Google Drive" },
  content_drive_url: {
    label: "Google Drive / Conteúdo",
    location: "Resumo ou aba Google Drive",
  },

  // These are the columns public.model_payments ACTUALLY has. The names in
  // 20260722000001_initial_schema.sql (pix_type, bank_agency, bank_account,
  // account_holder_cpf, payment_frequency) never matched the live table —
  // confirmed by introspection — so linking them produced a select that
  // failed on every load and an RPC call that could never have worked.
  pix_key: { label: "Chave PIX", location: "Aba Pagamentos" },
  pix_key_type: { label: "Tipo de chave PIX", location: "Aba Pagamentos" },
  bank_name: { label: "Banco", location: "Aba Pagamentos" },
  account_holder_name: { label: "Titular da conta", location: "Aba Pagamentos" },
  payout_frequency: { label: "Frequência de pagamento", location: "Aba Pagamentos" },
} as const;

export type LinkedFieldKey = keyof typeof LINKED_FIELDS;

export function isLinkedFieldKey(value: string): value is LinkedFieldKey {
  return Object.prototype.hasOwnProperty.call(LINKED_FIELDS, value);
}

/**
 * Columns the checklist may SHOW but must never write.
 *
 * The model's legal/actress name is deliberately here and not in
 * LINKED_FIELDS: it is not her OnlyFans username, the two differ on purpose,
 * and onboarding has no business changing it. Because these keys are absent
 * from the allowlist inside public.set_onboarding_linked_field, a write is
 * refused by the database even if the API and the UI were both wrong — the
 * name is unreachable from onboarding by construction, not by convention.
 */
export const READ_ONLY_LINKED_FIELDS = {
  display_name: {
    label: "Nome completo (nome da atriz)",
    location: "Resumo",
  },
} as const;

export type ReadOnlyLinkedFieldKey = keyof typeof READ_ONLY_LINKED_FIELDS;

export type AnyLinkedFieldKey = LinkedFieldKey | ReadOnlyLinkedFieldKey;

export function isReadOnlyLinkedFieldKey(
  value: string,
): value is ReadOnlyLinkedFieldKey {
  return Object.prototype.hasOwnProperty.call(READ_ONLY_LINKED_FIELDS, value);
}

export function linkedFieldLabel(key: AnyLinkedFieldKey): string {
  return isReadOnlyLinkedFieldKey(key)
    ? READ_ONLY_LINKED_FIELDS[key].label
    : LINKED_FIELDS[key].label;
}

export function linkedFieldLocation(key: AnyLinkedFieldKey): string {
  return isReadOnlyLinkedFieldKey(key)
    ? READ_ONLY_LINKED_FIELDS[key].location
    : LINKED_FIELDS[key].location;
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
   * checklist row — see the file header. A key from READ_ONLY_LINKED_FIELDS
   * is shown but never written from here.
   */
  linked?: AnyLinkedFieldKey;
};

/**
 * A step that ticks itself.
 *
 * Some requirements are genuinely optional: either the value is supplied, or
 * somebody decides it does not apply. Both outcomes are a finished decision, so
 * both count towards the percentage — and "nobody has looked at this yet" must
 * not. A hand-ticked checkbox cannot express that difference, so these steps
 * derive their state from two fields instead:
 *
 *   value filled in  → completed
 *   skip box ticked  → skipped   (also counts as done)
 *   neither          → pending   (does not count)
 *
 * The two are mutually exclusive and the server keeps them that way: filling in
 * the value clears the skip box, and ticking the skip box clears the value.
 */
export type OnboardingDerivedCompletion = {
  /** Field key whose value satisfies the step. */
  valueField: string;
  /** Checkbox field key that satisfies the step instead. */
  skipField: string;
};

export type OnboardingItem = {
  /** Permanent. See the file header. */
  key: string;
  title: string;
  description?: string;
  responsibility: OnboardingResponsibility;
  fields?: OnboardingField[];
  /** When set, the step is never ticked by hand. See the type above. */
  completion?: OnboardingDerivedCompletion;
};

export type OnboardingItemStatus = "completed" | "skipped" | "pending";

/**
 * The tri-state of a derived step, from the values its fields currently hold.
 * The single place this rule is expressed — the API, the percentage and the UI
 * all read it from here.
 */
export function resolveDerivedStatus(
  completion: OnboardingDerivedCompletion,
  values: Record<string, string>,
): OnboardingItemStatus {
  if ((values[completion.valueField] ?? "").trim() !== "") {
    return "completed";
  }

  if (isCheckboxChecked(values[completion.skipField])) {
    return "skipped";
  }

  return "pending";
}

export type OnboardingSection = {
  /** Permanent, same reasoning as item keys. */
  key: string;
  title: string;
  items: OnboardingItem[];
};

// ---------------------------------------------------------------------------
// The checklist
// ---------------------------------------------------------------------------

/**
 * Transcribed from "Live to Live — OnlyFans Model Onboarding Checklist"
 * (V1.0 / V2.3 / Feb 27 2026), pages 4–7. The numbered sections, their order
 * and their steps follow the document; each step's `description` carries the
 * matching "Refer to [n]" detail from the DETAILED STEPS FOR REFERENCE pages.
 *
 * Labels are pt-BR to match the rest of the admin, with the platform terms the
 * document uses left in English where they are the actual names of things.
 *
 * Two deliberate departures from the paper form:
 *   - "Full Name" is read-only here. It is the actress's legal name, which is
 *     NOT her OnlyFans username; the two differ on purpose and onboarding must
 *     never overwrite it. It is edited on the Resumo tab.
 *   - The document offers "Free Page" and "Paid Page" as two checkboxes, but
 *     only one can ever apply, so ticking both is wrong and ticking one leaves
 *     the section permanently short of 100%. It is one step with a choice.
 */
export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    key: "model_information",
    title: "Informações da modelo",
    items: [
      {
        key: "model_details",
        title: "Dados da modelo registrados",
        description:
          "Nome da atriz, usuário do OnlyFans, e-mail e telefone conferidos. O nome da atriz e o usuário do OnlyFans são diferentes — nunca substitua um pelo outro.",
        responsibility: "both",
        fields: [
          {
            key: "full_name",
            label: "Nome completo (nome da atriz)",
            type: "text",
            required: true,
            linked: "display_name",
          },
          {
            key: "onlyfans_username",
            label: "Usuário do OnlyFans",
            type: "text",
            placeholder: "@usuario",
            required: true,
            linked: "onlyfans",
          },
          {
            key: "email",
            label: "E-mail",
            type: "email",
            required: true,
            linked: "email",
          },
          {
            key: "phone",
            label: "Telefone",
            type: "tel",
            required: true,
            linked: "whatsapp",
          },
        ],
      },
      {
        // Optional by design: an e-mail OR an explicit "does not apply". Both
        // finish the step; leaving both empty does not. See
        // OnboardingDerivedCompletion.
        key: "secondary_email",
        title: "E-mail secundário",
        description:
          "Um segundo e-mail de contato, quando existir. Se a modelo não tiver um, marque a caixa para pular — a etapa conta como concluída nos dois casos, e fica pendente enquanto nenhum dos dois for preenchido.",
        responsibility: "both",
        completion: {
          valueField: "secondary_email",
          skipField: "skip_secondary_email",
        },
        fields: [
          {
            key: "secondary_email",
            label: "E-mail secundário",
            type: "email",
            placeholder: "segundo@exemplo.com",
          },
          {
            key: "skip_secondary_email",
            label: "Não se aplica / pular e-mail secundário",
            type: "checkbox",
          },
        ],
      },
      {
        key: "social_media_links",
        title: "Links de redes sociais registrados",
        description:
          "Todos os perfis usados na divulgação, mais o Instagram pessoal que não deve aparecer em lugar nenhum.",
        responsibility: "both",
        fields: [
          {
            key: "instagram_private",
            label: "Instagram (NÃO DEVE SER VISTO)",
            type: "text",
            linked: "instagram",
          },
          {
            key: "instagram_second",
            label: "Segundo Instagram",
            type: "text",
            linked: "instagram_marketing",
          },
          { key: "bumpy", label: "Bumpy", type: "text" },
          {
            key: "twitter",
            label: "Twitter / X",
            type: "text",
            linked: "twitter",
          },
          { key: "tiktok", label: "TikTok", type: "text", linked: "tiktok" },
          { key: "reddit", label: "Reddit", type: "text", linked: "reddit" },
          { key: "other", label: "Outro", type: "text" },
        ],
      },
      {
        key: "account_status",
        title: "Situação da conta registrada",
        responsibility: "agency",
        fields: [
          {
            key: "bank_account_linked",
            label: "Conta bancária vinculada",
            type: "select",
            options: ["Sim", "Não"],
            required: true,
          },
          {
            key: "approval_date",
            label: "Data de aprovação da conta",
            type: "date",
          },
        ],
      },
    ],
  },

  {
    key: "account_verification",
    title: "Verificação da conta",
    items: [
      {
        key: "identity_confirmation",
        title: "Confirmação de identidade",
        description:
          "Enviar um documento oficial com foto nítida e os dados do nome legal. O nome no OnlyFans deve corresponder ao do documento.",
        responsibility: "model",
      },
      {
        key: "social_media_linking",
        title: "Vinculação das redes sociais",
        description:
          "Conectar Instagram, Twitter, TikTok e Reddit para a verificação e a divulgação cruzada. Publicar os anúncios de verificação nas plataformas.",
        responsibility: "both",
      },
      {
        key: "bank_account_setup",
        title: "Configuração da conta bancária",
        description:
          "Vincular uma conta bancária pessoal ou empresarial para receber os pagamentos. Conferir os métodos aceitos pelo OnlyFans no país da modelo.",
        responsibility: "both",
      },
      {
        key: "approval_timeline",
        title: "Prazo de aprovação acompanhado",
        description:
          "Iniciar a verificação o quanto antes: a aprovação leva de 24 horas a alguns dias. Se demorar mais, acionar o suporte do OnlyFans.",
        responsibility: "agency",
      },
    ],
  },

  {
    key: "profile_optimization",
    title: "Otimização do perfil",
    items: [
      {
        key: "username_selection",
        title: "Escolha do nome de usuário",
        description:
          "Curto, memorável, alinhado ao nicho e representando a marca da modelo.",
        responsibility: "agency",
      },
      {
        key: "profile_photo",
        title: "Foto de perfil publicada",
        description:
          "Foto profissional, bem iluminada, mostrando o rosto ou a identidade da marca.",
        responsibility: "agency",
      },
      {
        key: "banner_image",
        title: "Banner publicado",
        description:
          "Banner que combina com o tema do conteúdo e complementa a marca. Usar Canva ou Photoshop para um acabamento profissional.",
        responsibility: "agency",
      },
      {
        key: "bio_description",
        title: "Bio escrita",
        description:
          "Bio concisa e envolvente, deixando claro o nicho e o que os assinantes podem esperar.",
        responsibility: "agency",
        fields: [{ key: "bio", label: "Bio publicada", type: "textarea" }],
      },
      {
        key: "call_to_action",
        title: "Chamada para ação incluída",
        description:
          'Exemplo: "Assine para conteúdo exclusivo todos os dias!".',
        responsibility: "agency",
        fields: [
          { key: "cta", label: "Chamada para ação", type: "text" },
        ],
      },
      {
        key: "content_previews",
        title: "Prévias de conteúdo publicadas",
        description:
          "Fixar uma publicação de amostra que mostre a qualidade do conteúdo a quem ainda não assina.",
        responsibility: "agency",
      },
      {
        key: "visibility_settings",
        title: "Configurações de visibilidade ajustadas",
        description:
          "No começo, esconder curtidas e número de seguidores para não afastar possíveis assinantes.",
        responsibility: "agency",
      },
      {
        key: "subscription_model",
        title: "Modelo de assinatura definido",
        description:
          "Página gratuita: atrai mais público, mas depende de vender conteúdo e mensagens (PPV). Página paga: receita direta e garantida por assinatura, com PPV somando, mas exige divulgação mais agressiva.",
        responsibility: "both",
        fields: [
          {
            key: "page_type",
            label: "Tipo de página",
            type: "select",
            options: ["Gratuita (Free)", "Paga (Paid)"],
            required: true,
          },
          {
            key: "subscription_price",
            label: "Valor da assinatura (USD)",
            type: "text",
          },
        ],
      },
      {
        key: "seo_optimization",
        title: "Otimização de SEO",
        description:
          "Usar palavras-chave relevantes na bio e nas descrições das publicações para melhorar a descoberta.",
        responsibility: "agency",
      },
      {
        key: "hashtag_usage",
        title: "Uso de hashtags",
        description:
          "Pesquisar e incorporar hashtags em alta e específicas do nicho para aumentar o alcance.",
        responsibility: "agency",
      },
    ],
  },

  {
    key: "content_strategy",
    title: "Estratégia de conteúdo",
    items: [
      {
        key: "niche_identification",
        title: "Nicho identificado",
        description:
          "Definir um diferencial claro e um tema consistente (fitness, cosplay, glamour, etc.).",
        responsibility: "both",
        fields: [{ key: "niche", label: "Nicho", type: "text", required: true }],
      },
      {
        key: "content_planning",
        title: "Planejamento de conteúdo",
        description:
          "Montar um calendário semanal/mensal com publicações, stories e ações de engajamento planejados com antecedência.",
        responsibility: "both",
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
    key: "legal_financial",
    title: "Aspectos legais e financeiros",
    items: [
      {
        key: "contracts",
        title: "Contratos assinados",
        description:
          "Acordo com validade jurídica entre a modelo e a agência, definindo os direitos sobre o conteúdo em documento legal.",
        responsibility: "both",
        fields: [
          { key: "signed_at", label: "Data da assinatura", type: "date" },
        ],
      },
      {
        key: "tax_compliance",
        title: "Situação fiscal tratada",
        description:
          "Conversar sobre as obrigações fiscais dos ganhos do OnlyFans e indicar um contador quando necessário.",
        responsibility: "both",
      },
      {
        key: "content_rights",
        title: "Direitos sobre o conteúdo definidos",
        description:
          "Deixar claro quem é o dono do conteúdo e como pode ser distribuído. Registrar os direitos e monitorar pirataria.",
        responsibility: "agency",
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
