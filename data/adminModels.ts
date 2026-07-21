export type ModelStatus =
  | "Onboarding concluído"
  | "Em andamento"
  | "Não iniciado"
  | "Ativa"
  | "Pausada"
  | "Inativa";

export type ContentStatus =
  | "Sem conteúdo novo"
  | "Aguardando modelo"
  | "Ação da agência"
  | "Em organização"
  | "Pronto para upload"
  | "Conteúdo agendado"
  | "Concluído";

export type AdminModel = {
  id: number;
  slug: string;
  name: string;
  status: ModelStatus;
  lastLogin: string | null;
  contentStatus: ContentStatus;
  latestNote: string;
  active: boolean;
};

export const adminModels: AdminModel[] = [
  {
    id: 1,
    slug: "raissa",
    name: "Raíssa",
    status: "Onboarding concluído",
    lastLogin: "2026-07-18T14:30:00",
    contentStatus: "Ação da agência",
    latestNote: "42 fotos e 8 vídeos recebidos; upload pendente.",
    active: true,
  },
  {
    id: 2,
    slug: "gleicy-kelly",
    name: "gleicy Kelly",
    status: "Em andamento",
    lastLogin: "2026-07-15T10:20:00",
    contentStatus: "Aguardando modelo",
    latestNote: "Aguardando envio de conteúdo inicial.",
    active: true,
  },
  {
    id: 3,
    slug: "daniele-da-silva",
    name: "Daniele da Silva",
    status: "Em andamento",
    lastLogin: null,
    contentStatus: "Aguardando modelo",
    latestNote: "Cadastro iniciado; login ainda não realizado.",
    active: true,
  },
  {
    id: 4,
    slug: "juliana",
    name: "Juliana",
    status: "Em andamento",
    lastLogin: "2026-07-09T18:10:00",
    contentStatus: "Sem conteúdo novo",
    latestNote: "Aguardando documentação de identificação.",
    active: true,
  },
  {
    id: 5,
    slug: "bonnie",
    name: "Bonnie",
    status: "Não iniciado",
    lastLogin: "2026-07-01T09:15:00",
    contentStatus: "Ação da agência",
    latestNote: "Vídeos recebidos; aguardando organização.",
    active: true,
  },
  {
    id: 6,
    slug: "jamilly",
    name: "Jamilly",
    status: "Ativa",
    lastLogin: "2026-07-14T12:00:00",
    contentStatus: "Em organização",
    latestNote: "Conteúdo recebido e separado por categoria.",
    active: true,
  },
  {
    id: 7,
    slug: "myrian-vm",
    name: "Myrian VM",
    status: "Ativa",
    lastLogin: "2026-07-16T20:10:00",
    contentStatus: "Pronto para upload",
    latestNote: "Novo conteúdo revisado e pronto para postagem.",
    active: true,
  },
  {
    id: 8,
    slug: "jenifer-aika",
    name: "Jenifer (Aika)",
    status: "Ativa",
    lastLogin: "2026-07-13T11:25:00",
    contentStatus: "Sem conteúdo novo",
    latestNote: "Perfil atualizado.",
    active: true,
  },
  {
    id: 9,
    slug: "joice-red-head",
    name: "Joice Red Head",
    status: "Ativa",
    lastLogin: "2026-07-12T19:30:00",
    contentStatus: "Aguardando modelo",
    latestNote: "Aguardando novo pacote de conteúdo.",
    active: true,
  },
  {
    id: 10,
    slug: "manu",
    name: "Manu",
    status: "Ativa",
    lastLogin: "2026-07-18T07:45:00",
    contentStatus: "Conteúdo agendado",
    latestNote: "Fotos e vídeos programados para publicação.",
    active: true,
  },
  {
    id: 11,
    slug: "lilith",
    name: "Lilith",
    status: "Em andamento",
    lastLogin: "2026-07-08T22:00:00",
    contentStatus: "Aguardando modelo",
    latestNote: "Aguardando banner e foto de perfil.",
    active: true,
  },
  {
    id: 12,
    slug: "thaina",
    name: "Thaina",
    status: "Não iniciado",
    lastLogin: null,
    contentStatus: "Sem conteúdo novo",
    latestNote: "Onboarding ainda não iniciado.",
    active: true,
  },
  {
    id: 13,
    slug: "thais-natielle-da-silva",
    name: "Thais Natielle da Silva",
    status: "Ativa",
    lastLogin: "2026-07-17T09:10:00",
    contentStatus: "Concluído",
    latestNote: "Último conteúdo publicado e agendado.",
    active: true,
  },
  {
    id: 14,
    slug: "rogeria-sousa",
    name: "Rogeria Sousa",
    status: "Não iniciado",
    lastLogin: null,
    contentStatus: "Sem conteúdo novo",
    latestNote: "Cadastro adicionado; onboarding ainda não iniciado.",
    active: true,
  },

  ...Array.from({ length: 16 }, (_, index) => {
    const id = index + 15;

    return {
      id,
      slug: `modelo-${id}`,
      name: `Modelo ${id}`,
      status: "Inativa" as ModelStatus,
      lastLogin: null,
      contentStatus: "Sem conteúdo novo" as ContentStatus,
      latestNote: "Vaga disponível.",
      active: false,
    };
  }),
];