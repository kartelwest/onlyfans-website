#!/usr/bin/env node
/**
 * Fails the build when the message catalogs drift apart.
 *
 * Two locales are easy to keep in step by hand right up until they aren't: a
 * key gets added to pt-BR during a feature, en-US never hears about it, and the
 * gap only shows up when an English reader hits that screen and sees a raw key
 * where a sentence should be. This runs in CI so that lands as a red build
 * instead.
 *
 * What counts as a failure:
 *   - a key present in one catalog and missing from the other
 *   - a key whose value is an empty (or whitespace-only) string
 *   - a key that is an object in one catalog and a string in the other, which
 *     would otherwise surface as a confusing runtime error deep in next-intl
 *   - an ICU placeholder such as {count} used in one locale but not the other,
 *     which is how a translated string quietly loses its number
 *
 * Exits 0 and prints a one-line summary when the catalogs agree.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MESSAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");

/**
 * Depth-first walk producing "a.b.c" paths for every leaf string.
 *
 * Arrays are walked by index rather than treated as leaves, because some copy
 * is genuinely a list — the FAQ is categories of questions of paragraphs, read
 * with `t.raw`. Indexing them means a paragraph present in one locale and
 * missing from the other shows up as a missing key (`…answer.3`) instead of
 * slipping through as "both sides have an array here".
 */
function flatten(value, prefix = "", out = new Map()) {
  const entries = Array.isArray(value)
    ? value.map((child, index) => [String(index), child])
    : Object.entries(value);

  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (child !== null && typeof child === "object") {
      flatten(child, path, out);
    } else {
      out.set(path, child);
    }
  }

  return out;
}

/**
 * ICU placeholders in a message. Only the argument NAME is captured, so
 * `{count, plural, ...}` and `{count}` count as the same argument.
 *
 * The lookahead is what keeps plural branches out of the results. In
 * `{count, plural, one {# item} other {# items}}` the inner `{# item}` and the
 * `one {…}` / `other {…}` keywords are message syntax, not arguments — an
 * argument name is always followed immediately by `}` or `,`, and nothing else
 * is. Without this, a language whose plural branches happen to start with a
 * word would be reported as having "extra placeholders".
 */
function placeholders(message) {
  if (typeof message !== "string") {
    return new Set();
  }

  const found = new Set();

  for (const match of message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*(?=[,}])/g)) {
    found.add(match[1]);
  }

  return found;
}

const files = readdirSync(MESSAGES_DIR).filter((name) => name.endsWith(".json"));

if (files.length < 2) {
  console.error(
    `i18n:check — expected at least two catalogs in messages/, found ${files.length}.`,
  );
  process.exit(1);
}

const catalogs = new Map();

for (const file of files) {
  const locale = file.replace(/\.json$/, "");
  const raw = readFileSync(join(MESSAGES_DIR, file), "utf8");

  try {
    catalogs.set(locale, flatten(JSON.parse(raw)));
  } catch (error) {
    console.error(`i18n:check — ${file} is not valid JSON: ${error.message}`);
    process.exit(1);
  }
}

const locales = [...catalogs.keys()].sort();

// The union of every key any catalog defines. Comparing each locale against the
// union (rather than pairwise) keeps the output readable once a third locale
// exists.
const allKeys = new Set();

for (const flat of catalogs.values()) {
  for (const key of flat.keys()) {
    allKeys.add(key);
  }
}

const problems = [];

for (const key of [...allKeys].sort()) {
  const missing = locales.filter((locale) => !catalogs.get(locale).has(key));

  if (missing.length > 0) {
    problems.push(`missing in ${missing.join(", ")}  →  ${key}`);
    continue;
  }

  for (const locale of locales) {
    const value = catalogs.get(locale).get(key);

    if (typeof value !== "string") {
      problems.push(
        `not a string in ${locale} (${typeof value})  →  ${key}`,
      );
      continue;
    }

    if (value.trim() === "") {
      problems.push(`empty value in ${locale}  →  ${key}`);
    }
  }

  // Placeholder parity, measured against the first locale that has the key.
  const reference = locales[0];
  const expected = placeholders(catalogs.get(reference).get(key));

  for (const locale of locales.slice(1)) {
    const actual = placeholders(catalogs.get(locale).get(key));

    const lost = [...expected].filter((name) => !actual.has(name));
    const extra = [...actual].filter((name) => !expected.has(name));

    if (lost.length > 0) {
      problems.push(
        `${locale} is missing placeholder(s) {${lost.join("}, {")}} present in ${reference}  →  ${key}`,
      );
    }

    if (extra.length > 0) {
      problems.push(
        `${locale} has extra placeholder(s) {${extra.join("}, {")}} not in ${reference}  →  ${key}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`\ni18n:check FAILED — ${problems.length} problem(s):\n`);

  for (const problem of problems) {
    console.error(`  ${problem}`);
  }

  console.error("");
  process.exit(1);
}

console.log(
  `i18n:check passed — ${allKeys.size} keys, identical across ${locales.join(", ")}.`,
);
