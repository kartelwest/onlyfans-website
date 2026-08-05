import "server-only";

export type PostBoardingItem = {
  /** Matches the original onboarding item_key for data migration. */
  key: string;
  title: string;
  description: string;
};

export type PostBoardingSection = {
  key: string;
  title: string;
  items: PostBoardingItem[];
};

/**
 * Ongoing work that used to be mixed into the onboarding checklist.
 * These items do not have checkboxes; each one carries an append-only,
 * editable thread of daily notes.
 */
export const POST_BOARDING_SECTIONS: PostBoardingSection[] = [
  {
    key: "post_boarding",
    title: "Pós-embarque",
    items: [
      {
        key: "profile_optimization.internal_linking",
        title: "Links internos entre publicações",
        description:
          "Divulgar publicações antigas ligando-as ao conteúdo relacionado nas legendas.",
      },
      {
        key: "profile_optimization.subscriber_lists",
        title: "Listas de assinantes configuradas",
        description:
          'Usar o recurso "Lists" para segmentar assinantes por interesse e gasto, e enviar promoções direcionadas.',
      },
      {
        key: "content_strategy.quality_assurance",
        title: "Garantia de qualidade",
        description:
          "Investir em iluminação adequada, câmera HD e ferramentas de edição para manter o valor de produção alto.",
      },
      {
        key: "marketing_promotion.social_media_integration",
        title: "Integração com redes sociais",
        description:
          "Divulgar o OnlyFans no Instagram, Twitter, TikTok, Reddit e Telegram, publicando prévias com consistência em todas as plataformas.",
      },
      {
        key: "marketing_promotion.collaborations",
        title: "Colaborações",
        description:
          "Fechar parcerias com outras criadoras para divulgação mútua, colabs e impulso de engajamento.",
      },
      {
        key: "marketing_promotion.engagement",
        title: "Engajamento",
        description:
          "Responder mensagens diariamente, fazer Q&As e lives para construir uma comunidade fiel.",
      },
      {
        key: "continuous_improvement.analytics_monitoring",
        title: "Acompanhamento de métricas",
        description:
          "Acompanhar crescimento de assinantes e taxas de engajamento, e conferir quais conteúdos rendem mais.",
      },
      {
        key: "continuous_improvement.feedback_collection",
        title: "Coleta de feedback",
        description:
          "Perguntar aos assinantes o que querem ver mais e usar isso para refinar o conteúdo.",
      },
      {
        key: "continuous_improvement.professional_development",
        title: "Desenvolvimento profissional",
        description:
          "Manter-se atualizado sobre recursos do OnlyFans e tendências de marketing.",
      },
    ],
  },
];

export type FlatPostBoardingItem = PostBoardingItem & {
  sectionKey: string;
  sectionTitle: string;
  itemOrder: number;
};

export function flattenPostBoarding(): FlatPostBoardingItem[] {
  return POST_BOARDING_SECTIONS.flatMap((section) =>
    section.items.map((item, index) => ({
      ...item,
      sectionKey: section.key,
      sectionTitle: section.title,
      itemOrder: index + 1,
    })),
  );
}

const itemsByKey = new Map(
  flattenPostBoarding().map((item) => [item.key, item]),
);

export function findPostBoardingItem(
  key: string,
): FlatPostBoardingItem | undefined {
  return itemsByKey.get(key);
}

export const POST_BOARDING_ITEM_KEYS = Array.from(itemsByKey.keys());
