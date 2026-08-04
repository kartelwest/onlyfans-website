import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CHECKBOX_TRUE,
  buildItemKey,
  findOnboardingItem,
  resolveDerivedStatus,
  type OnboardingDerivedCompletion,
} from "../lib/onboarding/definition";

const ITEM_KEY = buildItemKey("model_information", "secondary_email");

function completionOf(): OnboardingDerivedCompletion {
  const item = findOnboardingItem(ITEM_KEY);

  assert.ok(item, "the secondary e-mail step must exist");
  assert.ok(item.completion, "it must be a step that ticks itself");

  return item.completion;
}

describe("secondary e-mail onboarding step", () => {
  it("is optional: neither of its fields is required", () => {
    const item = findOnboardingItem(ITEM_KEY);

    assert.ok(item);
    assert.equal(
      (item.fields ?? []).some((field) => field.required),
      false,
    );
  });

  it("offers an e-mail box and a skip checkbox", () => {
    const item = findOnboardingItem(ITEM_KEY);
    const completion = completionOf();

    const value = item?.fields?.find(
      (field) => field.key === completion.valueField,
    );

    const skip = item?.fields?.find(
      (field) => field.key === completion.skipField,
    );

    assert.equal(value?.type, "email");
    assert.equal(skip?.type, "checkbox");
  });

  it("keeps both of its fields unlinked", () => {
    // The API recomputes a derived step's completion from the merged
    // field_values object. A linked field is stored in another table entirely,
    // so it would never appear there and the step would stop ticking itself.
    const item = findOnboardingItem(ITEM_KEY);

    for (const field of item?.fields ?? []) {
      assert.equal(
        field.linked,
        undefined,
        `${field.key} must not be a linked field`,
      );
    }
  });

  it("counts as completed once an e-mail is filled in", () => {
    const completion = completionOf();

    assert.equal(
      resolveDerivedStatus(completion, {
        [completion.valueField]: "segundo@exemplo.com",
      }),
      "completed",
    );
  });

  it("counts as skipped when the skip box is ticked", () => {
    const completion = completionOf();

    assert.equal(
      resolveDerivedStatus(completion, {
        [completion.skipField]: CHECKBOX_TRUE,
      }),
      "skipped",
    );
  });

  it("stays pending when neither is filled in", () => {
    const completion = completionOf();

    assert.equal(resolveDerivedStatus(completion, {}), "pending");

    // Whitespace is not an answer.
    assert.equal(
      resolveDerivedStatus(completion, {
        [completion.valueField]: "   ",
      }),
      "pending",
    );

    // Nor is an unticked box.
    assert.equal(
      resolveDerivedStatus(completion, {
        [completion.skipField]: "",
      }),
      "pending",
    );
  });

  it("prefers the e-mail when both are somehow set", () => {
    const completion = completionOf();

    // The API keeps the two mutually exclusive, so this state should never be
    // stored. If it ever is, a real value beats an assertion that there is
    // none.
    assert.equal(
      resolveDerivedStatus(completion, {
        [completion.valueField]: "segundo@exemplo.com",
        [completion.skipField]: CHECKBOX_TRUE,
      }),
      "completed",
    );
  });

  it("treats anything but the exact token as unticked", () => {
    const completion = completionOf();

    for (const value of ["TRUE", "1", "sim", "yes", "false"]) {
      assert.equal(
        resolveDerivedStatus(completion, { [completion.skipField]: value }),
        "pending",
        `"${value}" must not tick the skip box`,
      );
    }
  });
});
