import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * "Pós-embarque" was built on a side branch, reached the live database, and
 * never reached main — so it kept showing up in production while being absent
 * from the code anyone was reading. It has been removed
 * (20260805020000_drop_post_boarding.sql) and the daily checklist replaces it.
 *
 * These tests fail if any of it comes back by a merge nobody meant to make.
 */
const ROOT = join(import.meta.dirname, "..");

const SEARCHED_DIRS = ["app", "components", "lib", "messages", "types"];

const FORBIDDEN = /postBoarding|post_boarding|post-boarding|embarque/i;

/** Every source and catalogue file, excluding build output and dependencies. */
function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;

    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path);
      continue;
    }

    if (/\.(ts|tsx|json)$/.test(entry)) {
      yield path;
    }
  }
}

describe("the Pós-embarque workflow stays removed", () => {
  it("has no post-boarding code, copy or route left in the tree", () => {
    const offenders: string[] = [];

    for (const dir of SEARCHED_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        if (FORBIDDEN.test(readFileSync(file, "utf8"))) {
          offenders.push(file.slice(ROOT.length + 1));
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `post-boarding is back in: ${offenders.join(", ")}`,
    );
  });

  it("keeps the migration that takes it out of the database", () => {
    const migration = readFileSync(
      join(
        ROOT,
        "supabase/migrations/20260805020000_drop_post_boarding.sql",
      ),
      "utf8",
    );

    assert.match(
      migration,
      /drop table if exists public\.model_post_boarding_notes cascade;/,
    );

    assert.match(
      migration,
      /delete from public\.model_notes where source = 'post_boarding';/,
    );
  });

  // The drop has to land before the daily checklist widens the same
  // constraint, or the widened one would be applied on top of a database that
  // still holds source = 'post_boarding' rows and fail.
  it("runs before the daily checklist migrations", () => {
    const migrations = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    const drop = migrations.findIndex((name) =>
      name.includes("drop_post_boarding"),
    );

    const daily = migrations.findIndex((name) =>
      name.includes("daily_checklist_nightly_reset"),
    );

    assert.ok(drop >= 0, "the drop migration is missing");
    assert.ok(daily >= 0, "the nightly reset migration is missing");
    assert.ok(drop < daily, "the drop must run first");
  });
});
