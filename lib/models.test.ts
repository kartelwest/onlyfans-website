import { describe, expect, it } from "vitest";

import {
  getActiveModels,
  getModelById,
  getModelBySlug,
  models,
} from "@/lib/models";

describe("models dataset", () => {
  it("exposes a non-empty list of models", () => {
    expect(models.length).toBeGreaterThan(0);
  });

  it("has unique ids and slugs", () => {
    const ids = models.map((model) => model.id);
    const slugs = models.map((model) => model.slug);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every model onlyfans and instagram folder fields", () => {
    for (const model of models) {
      expect(model.folders).toHaveProperty("onlyfans");
      expect(model.folders).toHaveProperty("instagram");
      expect(typeof model.folders.onlyfans).toBe("string");
      expect(typeof model.folders.instagram).toBe("string");
    }
  });
});

describe("getModelBySlug", () => {
  it("returns the matching model for a known slug", () => {
    const model = getModelBySlug("raissa");

    expect(model).toBeDefined();
    expect(model?.id).toBe(1);
    expect(model?.name).toBe("Raíssa");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getModelBySlug("does-not-exist")).toBeUndefined();
  });

  it("is case sensitive", () => {
    expect(getModelBySlug("RAISSA")).toBeUndefined();
  });

  it("returns undefined for an empty slug", () => {
    expect(getModelBySlug("")).toBeUndefined();
  });
});

describe("getModelById", () => {
  it("returns the matching model for a known id", () => {
    const model = getModelById(3);

    expect(model).toBeDefined();
    expect(model?.slug).toBe("dani");
  });

  it("returns undefined for an unknown id", () => {
    expect(getModelById(9999)).toBeUndefined();
  });
});

describe("getActiveModels", () => {
  it("returns only models flagged as active", () => {
    const active = getActiveModels();

    expect(active.length).toBeGreaterThan(0);
    expect(active.every((model) => model.active)).toBe(true);
  });

  it("returns exactly the models whose active flag is true", () => {
    const expected = models.filter((model) => model.active);

    expect(getActiveModels()).toEqual(expected);
  });

  it("excludes inactive models", () => {
    const active = getActiveModels();

    expect(active.some((model) => model.slug === "model-4")).toBe(false);
  });
});
