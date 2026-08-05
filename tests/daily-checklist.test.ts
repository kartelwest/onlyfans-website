import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DAILY_SECTIONS,
  buildDailyItemKey,
  dailyBand,
  findDailyItem,
  flattenDaily,
} from "../lib/daily/definition";

/**
 * The daily checklist has three halves that must agree, and no runtime check
 * that catches them drifting apart:
 *
 *   1. the definition and the two message catalogues, because a step with no
 *      copy renders as a raw key;
 *   2. the colour bands, because the admin list and the Daily tab both paint
 *      from `dailyBand` and the thresholds are a business rule, not a taste;
 *   3. the item keys, because progress is matched on (model_id, item_key) and
 *      a renamed key silently orphans a model's recorded work.
 */
const ROOT = join(import.meta.dirname, "..");

const catalogue = (locale: string) =>
  JSON.parse(
    readFileSync(join(ROOT, "messages", `${locale}.json`), "utf8"),
  ) as {
    daily: {
      sections: Record<string, { title: string }>;
      items: Record<
        string,
        Record<string, { title: string; description: string }>
      >;
    };
  };

const LOCALES = ["pt-BR", "en-US"];

describe("daily checklist definition", () => {
  it("gives every step a unique key", () => {
    const keys = flattenDaily().map((item) =>
      buildDailyItemKey(item.sectionKey, item.key),
    );

    assert.equal(new Set(keys).size, keys.length);
  });

  it("resolves a stored item_key back to its step", () => {
    const first = flattenDaily()[0];
    const key = buildDailyItemKey(first.sectionKey, first.key);

    assert.deepEqual(findDailyItem(key), first);
    assert.equal(findDailyItem("nao.existe"), undefined);
  });

  it("orders sections and items from 1", () => {
    const flat = flattenDaily();

    assert.equal(flat[0].sectionOrder, 1);
    assert.equal(flat[0].itemOrder, 1);

    for (const section of DAILY_SECTIONS) {
      assert.ok(section.items.length > 0, `${section.key} has no steps`);
    }
  });
});

describe("daily checklist copy", () => {
  for (const locale of LOCALES) {
    it(`has a title and a description for every step in ${locale}`, () => {
      const { daily } = catalogue(locale);

      for (const section of DAILY_SECTIONS) {
        assert.ok(
          daily.sections[section.key]?.title,
          `${locale}: no title for section ${section.key}`,
        );

        for (const item of section.items) {
          const entry = daily.items[section.key]?.[item.key];

          assert.ok(
            entry?.title,
            `${locale}: no title for ${section.key}.${item.key}`,
          );
          assert.ok(
            entry?.description,
            `${locale}: no description for ${section.key}.${item.key}`,
          );
        }
      }
    });

    it(`carries no copy for a step that no longer exists in ${locale}`, () => {
      const { daily } = catalogue(locale);

      for (const [sectionKey, items] of Object.entries(daily.items)) {
        const section = DAILY_SECTIONS.find((one) => one.key === sectionKey);

        assert.ok(section, `${locale}: orphan section copy ${sectionKey}`);

        for (const itemKey of Object.keys(items)) {
          assert.ok(
            section.items.some((one) => one.key === itemKey),
            `${locale}: orphan copy ${sectionKey}.${itemKey}`,
          );
        }
      }
    });
  }
});

describe("daily colour bands", () => {
  // Red at 60% or less, yellow from 61 to 85, green from 86 up. The boundaries
  // are the whole point, so they are asserted one by one.
  it("paints the boundaries the way the agency asked", () => {
    assert.equal(dailyBand(0), "red");
    assert.equal(dailyBand(60), "red");
    assert.equal(dailyBand(61), "yellow");
    assert.equal(dailyBand(85), "yellow");
    assert.equal(dailyBand(86), "green");
    assert.equal(dailyBand(100), "green");
  });
});
