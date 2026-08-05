import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Deleting an administrator was always the owner's to do — the server action
 * and the profiles_delete RLS policy both said so. What was missing was any
 * sign of it on the screen where administrators are listed: representatives
 * had a red Delete button on the row, administrators had a neutral "Manage
 * account" link pointing somewhere else. Same power, two presentations, and
 * the owner reasonably read the difference as a permission he had never been
 * given.
 *
 * These tests pin the rules that make the new button safe, and the two that
 * make the list honest:
 *
 *   - only an owner may delete, checked against the database;
 *   - the target must be an administrator, which is what stops an owner
 *     deleting themselves out of their own business;
 *   - an account still holding models is refused, because
 *     models.representative_id is ON DELETE SET NULL and would silently
 *     unassign them;
 *   - the owner appears in the list, with every row carrying its own role.
 */
const ROOT = join(import.meta.dirname, "..");

const action = readFileSync(
  join(ROOT, "app/admin/administrators/actions.ts"),
  "utf8",
);
const page = readFileSync(join(ROOT, "app/admin/models/page.tsx"), "utf8");
const button = readFileSync(
  join(ROOT, "components/admin/DeleteAdministratorButton.tsx"),
  "utf8",
);

describe("deleting an administrator is the owner's alone", () => {
  it("refuses any actor who is not an owner", () => {
    assert.match(
      action,
      /actor\.role\s*!==\s*"owner"/,
      "the action must check the actor's role against the database",
    );
    assert.match(action, /ownerOnlyDelete/);
  });

  it("reads the actor's role from the database, never from the request", () => {
    const roleRead = action.indexOf('.from("profiles")');
    const roleCheck = action.indexOf('actor.role !== "owner"');

    assert.ok(roleRead > -1 && roleRead < roleCheck);
    assert.ok(
      !/formData\.get\(\s*["']role["']\s*\)/.test(action),
      "a role supplied by the caller would be a privilege-escalation hole",
    );
  });

  it("refuses a target that is not an administrator", () => {
    // This is the rule that keeps an owner — or anyone — from deleting an
    // owner through this path.
    assert.match(action, /target\?\.role\s*!==\s*"administrator"/);
    assert.match(action, /notAnAdministrator/);
  });

  it("refuses to delete the actor's own account", () => {
    assert.match(action, /administratorId === actor\.id/);
    assert.match(action, /cannotDeleteSelf/);
  });

  it("refuses while models are still assigned", () => {
    assert.match(action, /eq\("representative_id", administratorId\)/);
    assert.match(action, /assignedCount > 0/);
    assert.match(action, /stillHasModels/);
  });

  it("checks everything before it deletes anything", () => {
    const ownerCheck = action.indexOf('actor.role !== "owner"');
    const targetCheck = action.indexOf('target?.role !== "administrator"');
    const assignedCheck = action.indexOf("assignedCount > 0");
    const destructive = action.indexOf("auth.admin.deleteUser");

    for (const [label, at] of [
      ["owner check", ownerCheck],
      ["target check", targetCheck],
      ["assigned-models check", assignedCheck],
    ] as const) {
      assert.ok(at > -1 && at < destructive, `${label} must precede deletion`);
    }
  });

  it("removes the login before the profile row", () => {
    // The other order leaves a working login attached to an account that no
    // longer exists if the second step fails.
    assert.ok(
      action.indexOf("auth.admin.deleteUser") <
        action.indexOf('.from("profiles")\n    .delete()'),
    );
  });

  it("records the deletion where it outlives the account", () => {
    assert.match(action, /logSystemAuditEntry/);
    assert.match(action, /action: "administrator_deleted"/);
    assert.ok(
      // The call site, not the import at the top of the file.
      action.indexOf("await logSystemAuditEntry(") >
        action.indexOf("auth.admin.deleteUser"),
      "the audit row is written after the account is gone, and survives it",
    );
  });
});

describe("the administrators list", () => {
  it("includes the owner", () => {
    assert.match(page, /loadStaffProfiles\(supabase, "owner"\)/);
    assert.match(page, /\[\.\.\.owners, \.\.\.administratorProfiles\]/);
  });

  it("labels every row with its role", () => {
    assert.match(page, /showRoleBadge/);
    assert.match(page, /useTranslations\("enums\.role"\)/);
    assert.match(page, /tRole\(profile\.role\)/);
  });

  it("offers the delete button only on administrator rows", () => {
    assert.match(
      page,
      /showDeleteAdministrator &&\s*\n?\s*profile\.role === "administrator"/,
      "the owner's own row must never render a delete button",
    );
  });

  it("gates the button on the assigned-model count", () => {
    assert.match(page, /assignedCountByProfile/);
    assert.match(button, /assignedModelCount > 0/);
    assert.match(button, /blocked \? undefined : t\("confirmPhrase"\)/);
  });

  it("sends a fixed literal, not the localised phrase", () => {
    // The typed phrase is translated; the wire value must not be, or the
    // action would reject an owner reading in English.
    assert.match(button, /formData\.set\("confirmation", "EXCLUIR"\)/);
    assert.match(action, /confirmation !== "EXCLUIR"/);
  });
});
