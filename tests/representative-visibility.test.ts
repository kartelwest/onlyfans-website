import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What a representative may see on her client's page is decided in two places:
 * public.rep_visible_audit_action() enforces it, and the history route filters
 * on the same list so the paging counts match what RLS would return anyway.
 *
 * Two copies of one rule drift. These tests fail when they do — and, more
 * importantly, when someone widens the list without meaning to.
 */
const ROOT = join(import.meta.dirname, "..");

const MIGRATION = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260804020000_representative_note_visibility.sql",
  ),
  "utf8",
);

const HISTORY_ROUTE = readFileSync(
  join(ROOT, "app/api/models/history/route.ts"),
  "utf8",
);

/** The actions inside `select p_action in ( … );`. */
function actionsAllowedBySql(): string[] {
  const body = MIGRATION.split(
    "create or replace function public.rep_visible_audit_action",
  )[1];

  assert.ok(body, "rep_visible_audit_action is missing from the migration");

  const list = body.slice(
    body.indexOf("p_action in ("),
    body.indexOf(");"),
  );

  return [...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort();
}

/** The actions inside REP_VISIBLE_AUDIT_ACTIONS in the route. */
function actionsAllowedByRoute(): string[] {
  const block = HISTORY_ROUTE.split("REP_VISIBLE_AUDIT_ACTIONS = [")[1];

  assert.ok(block, "REP_VISIBLE_AUDIT_ACTIONS is missing from the route");

  return [...block.slice(0, block.indexOf("]")).matchAll(/"([a-z_]+)"/g)]
    .map((match) => match[1])
    .sort();
}

describe("representative audit visibility", () => {
  it("keeps the SQL allowlist and the API filter identical", () => {
    assert.deepEqual(actionsAllowedByRoute(), actionsAllowedBySql());
  });

  it("shows the onboarding checklist and nothing else", () => {
    assert.deepEqual(actionsAllowedBySql(), [
      "checklist_update",
      "onboarding_update",
    ]);
  });

  it("never admits the actions that carry credentials or surveillance", () => {
    const allowed = actionsAllowedBySql();

    for (const action of [
      // previous_value / new_value carry the model's login e-mail.
      "model_credentials_created",
      "model_credentials_updated",
      // A log of the representative herself.
      "view_as_representative_enter",
      "view_as_representative_exit",
      // Infrastructure and money.
      "proxy_update",
      "earnings_created",
      "monthly_earnings_updated",
      // Who may read a note is a staff decision, and so is its record.
      "note_visibility_changed",
    ]) {
      assert.ok(
        !allowed.includes(action),
        `${action} must stay staff-only`,
      );
    }
  });

  it("applies the filter to non-staff readers only", () => {
    assert.match(
      HISTORY_ROUTE,
      /if \(!isStaff\) \{\s*query = query\.in\("action", REP_VISIBLE_AUDIT_ACTIONS\);/,
    );
  });
});

describe("note sharing", () => {
  it("defaults rep_visible to false", () => {
    assert.match(
      MIGRATION,
      /add column if not exists rep_visible boolean not null default false/,
    );
  });

  it("lets a representative read her own notes and the shared ones", () => {
    const policy = MIGRATION.split("create policy notes_select")[1];

    assert.match(policy, /created_by = auth\.uid\(\)/);
    assert.match(policy, /or rep_visible/);
    // A shared note that was soft-deleted is still gone for her.
    assert.match(policy, /deleted_at is null/);
  });

  it("refuses the flag to anyone who is not staff", () => {
    const guard = MIGRATION.split("function public.guard_note_rep_visible")[1];

    assert.match(guard, /new\.rep_visible is distinct from old\.rep_visible/);
    assert.match(guard, /not public\.is_staff\(\)/);
    assert.match(guard, /errcode = '42501'/);
  });
});
