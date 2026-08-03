import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildRepresentativeAssignmentNote,
  getRoleLabel,
} from "../lib/models/representativeAssignment";
import { formatBrazilDateTime } from "../lib/models/formatDateTime";

describe("getRoleLabel", () => {
  it("returns Portuguese labels for staff and rep roles", () => {
    assert.equal(getRoleLabel("owner"), "Proprietário");
    assert.equal(getRoleLabel("administrator"), "Administrador");
    assert.equal(getRoleLabel("representative"), "Representante");
    assert.equal(getRoleLabel("model"), "Modelo");
    assert.equal(getRoleLabel(null), "Usuário");
    assert.equal(getRoleLabel(undefined), "Usuário");
  });
});

describe("buildRepresentativeAssignmentNote", () => {
  const actorName = "Kartel West";
  const actorRole = "owner" as const;
  const changedAt = new Date("2026-08-03T16:25:00-03:00");
  const timestamp = formatBrazilDateTime(changedAt);

  it("describes a first-time assignment", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: null,
      previousRepresentativeName: null,
      newRepresentativeId: "new-id",
      newRepresentativeName: "João Santos",
      actorName,
      actorRole,
      changedAt,
    });

    assert.equal(result.previousRepresentativeId, null);
    assert.equal(result.newRepresentativeId, "new-id");
    assert.ok(result.body.includes("João Santos"));
    assert.ok(result.body.includes("atribuído"));
    assert.ok(result.body.includes(actorName));
    assert.ok(result.body.includes("Proprietário"));
    assert.ok(result.body.includes(timestamp));
  });

  it("describes a replacement", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: "prev-id",
      previousRepresentativeName: "Maria Silva",
      newRepresentativeId: "new-id",
      newRepresentativeName: "João Santos",
      actorName,
      actorRole,
      changedAt,
    });

    assert.equal(result.previousRepresentativeId, "prev-id");
    assert.equal(result.newRepresentativeId, "new-id");
    assert.ok(result.body.includes("Maria Silva"));
    assert.ok(result.body.includes("João Santos"));
    assert.ok(result.body.includes("alterado de"));
    assert.ok(result.body.includes(timestamp));
  });

  it("describes a removal", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: "prev-id",
      previousRepresentativeName: "Maria Silva",
      newRepresentativeId: null,
      newRepresentativeName: null,
      actorName,
      actorRole,
      changedAt,
    });

    assert.equal(result.previousRepresentativeId, "prev-id");
    assert.equal(result.newRepresentativeId, null);
    assert.ok(result.body.includes("Maria Silva"));
    assert.ok(result.body.includes("removido"));
    assert.ok(result.body.includes(timestamp));
  });

  it("falls back to generic names when names are unavailable", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: null,
      previousRepresentativeName: null,
      newRepresentativeId: "new-id",
      newRepresentativeName: null,
      actorName,
      actorRole,
      changedAt,
    });

    assert.ok(result.body.includes("Representante"));
  });

  it("records no change when both ids are null", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: null,
      newRepresentativeId: null,
      actorName,
      actorRole,
      changedAt,
    });

    assert.ok(result.body.includes("Nenhuma alteração"));
  });

  it("uses the administrator role label", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: null,
      newRepresentativeId: "new-id",
      newRepresentativeName: "João Santos",
      actorName: "Ana Lima",
      actorRole: "administrator",
      changedAt,
    });

    assert.ok(result.body.includes("Ana Lima"));
    assert.ok(result.body.includes("Administrador"));
  });

  it("uses the representative role label", () => {
    const result = buildRepresentativeAssignmentNote({
      previousRepresentativeId: null,
      newRepresentativeId: "new-id",
      newRepresentativeName: "João Santos",
      actorName: "Carlos Souza",
      actorRole: "representative",
      changedAt,
    });

    assert.ok(result.body.includes("Representante"));
  });
});
