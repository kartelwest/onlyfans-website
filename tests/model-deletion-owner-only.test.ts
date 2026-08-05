import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Permanent deletion of a model is the only action in the product that is both
 * irreversible and self-erasing: public.models is the parent of more than
 * twenty tables that cascade, model_audit_history among them, so removing one
 * row destroys the model, her whole financial record, and the trail that would
 * show what happened.
 *
 * It had drifted open in three places at once, each of which these tests pin:
 *
 *   1. The route accepted an administrator and did the work through the
 *      service-role client, which bypasses RLS entirely.
 *   2. The audit row was written AFTER the delete, into model_audit_history —
 *      a table whose model_id cascades from the row being deleted. The insert
 *      was a foreign key violation against a model that no longer existed, its
 *      error was discarded, and production accumulated zero `model_deleted`
 *      records as a result.
 *   3. The admin models list showed the delete button to administrators.
 *
 * The database is pinned by 20260805070000_models_delete_owner_only.sql, which
 * dropped two permissive `is_management()` delete policies that between them
 * let an administrator DELETE straight through PostgREST.
 */
const ROOT = join(import.meta.dirname, "..");

const routeSource = readFileSync(
  join(ROOT, "app/api/models/delete/route.ts"),
  "utf8",
);

describe("permanent model deletion stays owner-only", () => {
  it("the route admits the owner and nobody else", () => {
    assert.match(
      routeSource,
      /if\s*\(\s*role\s*!==\s*"owner"\s*\)/,
      "the guard must be an owner-only check",
    );

    assert.ok(
      !/role\s*!==\s*"administrator"/.test(routeSource),
      "an `administrator` alternative in the guard means admins can delete again",
    );
  });

  it("records the deletion before anything is destroyed", () => {
    const auditAt = routeSource.indexOf("logSystemAuditEntry");
    const deleteAt = routeSource.search(
      /\.from\(\s*"models"\s*\)\s*\.delete\(\s*\)/,
    );

    assert.ok(auditAt > -1, "the deletion must be written to system_audit_log");
    assert.ok(deleteAt > -1, "the route must still delete the model row");
    assert.ok(
      auditAt < deleteAt,
      "the audit entry must be written BEFORE the delete — afterwards the " +
        "cascade has already taken model_audit_history with it",
    );
  });

  it("refuses to delete when the deletion cannot be recorded", () => {
    assert.match(
      routeSource,
      /auditError/,
      "the audit write's error must be checked, not discarded",
    );
  });

  it("does not log the deletion to the table that cascades away", () => {
    assert.ok(
      !/logAuditEntry\b/.test(routeSource),
      "model_audit_history cascades from models; a row written there during a " +
        "deletion is a foreign key violation and leaves no trail at all",
    );
  });

  it("deletes the rows through the caller's client so RLS still applies", () => {
    const rowDeletes = routeSource.match(/adminSupabase\s*\n?\s*\.from\(/g);

    assert.strictEqual(
      rowDeletes,
      null,
      "row deletes must go through the request-scoped client, so the " +
        "owner-only RLS policy gets an independent say; the service-role " +
        "client is for auth.admin.deleteUser only",
    );

    assert.match(
      routeSource,
      /adminSupabase\.auth\.admin\.deleteUser/,
      "removing the sign-in account still needs the service-role client",
    );
  });

  it("the admin models list shows the delete button to the owner alone", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/models/page.tsx"),
      "utf8",
    );

    assert.match(
      page,
      /const canManage = role === "owner";/,
      "canManage gates the permanent-delete button and must be owner-only",
    );
  });

  it("the migration restoring the owner-only delete policy is present", () => {
    const migration = readFileSync(
      join(
        ROOT,
        "supabase/migrations/20260805070000_models_delete_owner_only.sql",
      ),
      "utf8",
    );

    assert.match(migration, /drop policy if exists "management can delete models"/);
    assert.match(migration, /drop policy if exists models_delete_management/);
    assert.match(
      migration,
      /create policy models_delete[\s\S]*using\s*\(\s*public\.is_owner\(\)\s*\)/,
    );
  });
});
