import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  LINKED_FIELDS,
  ONBOARDING_ITEM_COUNT,
  ONBOARDING_SECTIONS,
  READ_ONLY_LINKED_FIELDS,
  buildItemKey,
  findOnboardingField,
  findOnboardingItem,
  flattenOnboarding,
  isLinkedFieldKey,
  isReadOnlyLinkedFieldKey,
} from "../lib/onboarding/definition";

const MIGRATION_PATH = fileURLToPath(
  new URL(
    "../supabase/migrations/20260803000000_onboarding_checklist_rework.sql",
    import.meta.url,
  ),
);

describe("onboarding definition", () => {
  it("gives every section a unique key", () => {
    const keys = ONBOARDING_SECTIONS.map((section) => section.key);

    assert.equal(new Set(keys).size, keys.length);
  });

  it("gives every item a unique key within its section", () => {
    for (const section of ONBOARDING_SECTIONS) {
      const keys = section.items.map((item) => item.key);

      assert.equal(
        new Set(keys).size,
        keys.length,
        `duplicate item key in section "${section.key}"`,
      );
    }
  });

  it("produces a unique seeded item_key for every item", () => {
    const items = flattenOnboarding();

    const keys = items.map((item) => buildItemKey(item.sectionKey, item.key));

    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keys.length, ONBOARDING_ITEM_COUNT);
  });

  it("gives every field a unique key within its item", () => {
    for (const item of flattenOnboarding()) {
      const keys = (item.fields ?? []).map((field) => field.key);

      assert.equal(
        new Set(keys).size,
        keys.length,
        `duplicate field key in item "${item.key}"`,
      );
    }
  });

  it("numbers sections and items from one, in declaration order", () => {
    const items = flattenOnboarding();

    assert.equal(items[0].sectionOrder, 1);
    assert.equal(items[0].itemOrder, 1);

    for (const section of ONBOARDING_SECTIONS) {
      const sectionItems = items.filter(
        (item) => item.sectionKey === section.key,
      );

      assert.deepEqual(
        sectionItems.map((item) => item.itemOrder),
        sectionItems.map((_, index) => index + 1),
      );
    }
  });

  it("only links fields the linked-field registry knows", () => {
    for (const item of flattenOnboarding()) {
      for (const field of item.fields ?? []) {
        if (!field.linked) continue;

        assert.ok(
          isLinkedFieldKey(field.linked) ||
            isReadOnlyLinkedFieldKey(field.linked),
          `item "${item.key}" links unknown field "${field.linked}"`,
        );
      }
    }
  });

  it("does not link the same column from two different steps", () => {
    // Two steps writing one column would let each overwrite the other's value
    // with no indication in either place.
    const seen = new Map<string, string>();

    for (const item of flattenOnboarding()) {
      for (const field of item.fields ?? []) {
        if (!field.linked) continue;

        const previous = seen.get(field.linked);

        assert.equal(
          previous,
          undefined,
          `"${field.linked}" is linked by both "${previous}" and "${item.key}"`,
        );

        seen.set(field.linked, item.key);
      }
    }
  });

  it("finds items and fields by key", () => {
    const first = flattenOnboarding()[0];
    const itemKey = buildItemKey(first.sectionKey, first.key);

    assert.equal(findOnboardingItem(itemKey)?.title, first.title);
    assert.equal(findOnboardingItem("nope.nope"), undefined);

    const field = first.fields?.[0];

    if (field) {
      assert.equal(findOnboardingField(itemKey, field.key)?.label, field.label);
      assert.equal(findOnboardingField(itemKey, "nope"), undefined);
    }
  });
});

describe("linked fields stay in step with the database", () => {
  // public.set_onboarding_linked_field is the authority on what the checklist
  // may write. A key offered by the UI but missing from that allowlist fails
  // at save time, which is exactly the kind of drift this catches at build.
  const migration = readFileSync(MIGRATION_PATH, "utf8");

  function sqlAllowlist(variable: string): string[] {
    const match = migration.match(
      new RegExp(`${variable}\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`),
    );

    assert.ok(match, `could not find the ${variable} allowlist in the migration`);

    return Array.from(match[1].matchAll(/'([^']+)'/g)).map((hit) => hit[1]);
  }

  it("declares every linked field in the SQL allowlist", () => {
    const allowed = new Set([
      ...sqlAllowlist("model_columns"),
      ...sqlAllowlist("payment_columns"),
    ]);

    for (const key of Object.keys(LINKED_FIELDS)) {
      assert.ok(
        allowed.has(key),
        `"${key}" is offered by the UI but set_onboarding_linked_field rejects it`,
      );
    }
  });

  it("allows exactly the registry, nothing more", () => {
    const registered = new Set(Object.keys(LINKED_FIELDS));

    for (const key of [
      ...sqlAllowlist("model_columns"),
      ...sqlAllowlist("payment_columns"),
    ]) {
      assert.ok(
        registered.has(key),
        `set_onboarding_linked_field accepts "${key}", which is not a linkable field`,
      );
    }
  });

  it("never allows a read-only column to be written", () => {
    // The whole point of READ_ONLY_LINKED_FIELDS: the actress's legal name has
    // no path to a write. If one of these ever appears in the RPC allowlist,
    // onboarding could overwrite her name with her OnlyFans username.
    const allowed = new Set([
      ...sqlAllowlist("model_columns"),
      ...sqlAllowlist("payment_columns"),
    ]);

    for (const key of Object.keys(READ_ONLY_LINKED_FIELDS)) {
      assert.ok(
        !allowed.has(key),
        `"${key}" is read-only but set_onboarding_linked_field would write it`,
      );

      assert.ok(
        !isLinkedFieldKey(key),
        `"${key}" is read-only but also registered as writable`,
      );
    }
  });

  it("keeps the actress name and the OnlyFans username apart", () => {
    // They are different values by design. One step carries both, and the name
    // must be the read-only one.
    const fields = flattenOnboarding()
      .flatMap((item) => item.fields ?? [])
      .filter((field) => field.linked);

    const nameField = fields.find((field) => field.linked === "display_name");
    const usernameField = fields.find((field) => field.linked === "onlyfans");

    assert.ok(nameField, "the actress name is not shown anywhere");
    assert.ok(usernameField, "the OnlyFans username is not captured anywhere");
    assert.notEqual(nameField?.key, usernameField?.key);

    assert.ok(
      isReadOnlyLinkedFieldKey(String(nameField?.linked)),
      "the actress name must be read-only in the checklist",
    );
    assert.ok(
      isLinkedFieldKey(String(usernameField?.linked)),
      "the OnlyFans username must be writable",
    );
  });
});
