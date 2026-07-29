import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  modelStatusRank,
  normalizeModelStatus,
  sortByModelStatus,
} from "../lib/models/modelStatusOrder";

describe("normalizeModelStatus", () => {
  it("keeps known statuses", () => {
    assert.equal(normalizeModelStatus("candidate", false), "candidate");
    assert.equal(normalizeModelStatus("denied", true), "denied");
  });

  it("falls back to the active flag for unknown statuses", () => {
    assert.equal(normalizeModelStatus(null, true), "active");
    assert.equal(normalizeModelStatus("not_started", false), "inactive");
  });
});

describe("modelStatusRank", () => {
  it("ranks ativa, candidata, inativa, negada in that order", () => {
    const ranks = ["active", "candidate", "inactive", "denied"].map((status) =>
      modelStatusRank(status, true),
    );

    assert.deepEqual(ranks, [0, 1, 2, 3]);
  });
});

describe("sortByModelStatus", () => {
  const models = [
    { name: "Denise", status: "denied", active: false },
    { name: "Bruna", status: "inactive", active: false },
    { name: "Carla", status: "candidate", active: false },
    { name: "Ana", status: "active", active: true },
  ];

  it("moves active models to the top", () => {
    const sorted = sortByModelStatus(models, (model) => ({
      status: model.status,
      active: model.active,
      name: model.name,
    }));

    assert.deepEqual(
      sorted.map((model) => model.name),
      ["Ana", "Carla", "Bruna", "Denise"],
    );
  });

  it("breaks ties by name when provided", () => {
    const sorted = sortByModelStatus(
      [
        { name: "Zoe", status: "active", active: true },
        { name: "Ágata", status: "active", active: true },
      ],
      (model) => ({
        status: model.status,
        active: model.active,
        name: model.name,
      }),
    );

    assert.deepEqual(
      sorted.map((model) => model.name),
      ["Ágata", "Zoe"],
    );
  });

  it("preserves the incoming order within a status when no name is given", () => {
    const sorted = sortByModelStatus(
      [
        { number: 2, status: "candidate", active: false },
        { number: 1, status: "active", active: true },
        { number: 3, status: "active", active: true },
      ],
      (model) => ({ status: model.status, active: model.active }),
    );

    assert.deepEqual(
      sorted.map((model) => model.number),
      [1, 3, 2],
    );
  });

  it("does not mutate the input array", () => {
    const input = [...models];

    sortByModelStatus(input, (model) => ({
      status: model.status,
      active: model.active,
      name: model.name,
    }));

    assert.equal(input[0].name, "Denise");
  });
});
