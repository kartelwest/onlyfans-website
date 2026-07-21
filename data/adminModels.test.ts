import { describe, expect, it } from "vitest";

import {
  adminModels,
  type ContentStatus,
  type ModelStatus,
} from "@/data/adminModels";

const validStatuses: ModelStatus[] = [
  "Onboarding concluído",
  "Em andamento",
  "Não iniciado",
  "Ativa",
  "Pausada",
  "Inativa",
];

const validContentStatuses: ContentStatus[] = [
  "Sem conteúdo novo",
  "Aguardando modelo",
  "Ação da agência",
  "Em organização",
  "Pronto para upload",
  "Conteúdo agendado",
  "Concluído",
];

describe("adminModels dataset", () => {
  it("contains the expected number of entries", () => {
    // 14 hand-authored models + 16 generated placeholders.
    expect(adminModels).toHaveLength(30);
  });

  it("has sequential unique ids starting at 1", () => {
    const ids = adminModels.map((model) => model.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      Array.from({ length: adminModels.length }, (_, index) => index + 1),
    );
  });

  it("has unique slugs", () => {
    const slugs = adminModels.map((model) => model.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only uses known status values", () => {
    for (const model of adminModels) {
      expect(validStatuses).toContain(model.status);
      expect(validContentStatuses).toContain(model.contentStatus);
    }
  });

  it("uses null (never an empty string) for a missing lastLogin", () => {
    for (const model of adminModels) {
      expect(model.lastLogin === null || model.lastLogin.length > 0).toBe(true);
    }
  });

  it("marks the generated placeholder models as inactive", () => {
    const generated = adminModels.filter((model) => model.id >= 15);

    expect(generated).toHaveLength(16);
    expect(
      generated.every(
        (model) =>
          model.active === false &&
          model.status === "Inativa" &&
          model.slug === `modelo-${model.id}` &&
          model.lastLogin === null,
      ),
    ).toBe(true);
  });

  it("keeps the hand-authored models active", () => {
    const authored = adminModels.filter((model) => model.id < 15);

    expect(authored).toHaveLength(14);
    expect(authored.every((model) => model.active)).toBe(true);
  });

  it("gives every model a non-empty latest note", () => {
    for (const model of adminModels) {
      expect(model.latestNote.length).toBeGreaterThan(0);
    }
  });
});
