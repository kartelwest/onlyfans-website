<!--
  Copy this file to `rayssa/AGENTS.md` in the karaymodels repository.
  It is the standing rules an agent reads every session. The full spec lives at
  docs/rayssa/BUILD-PROMPT.md — read that too, but these rules bind regardless.
-->

# RAYSSA — standing rules

Internal marketing operations platform for a talent agency. The full specification is at
`docs/rayssa/BUILD-PROMPT.md`. **Read it before writing code.** These rules apply every
session and override any instinct to the contrary.

## Rule zero: stay inside `rayssa/`

**This repository also contains karaymodels.com, a live production website serving real
traffic.** It is everything outside the `rayssa/` directory.

You may **read** any file in this repository — you are expected to, and section 9 of the spec
depends on it. You may **write** only inside `rayssa/`.

Do not edit, move, rename, refactor, reformat, or delete a single file outside `rayssa/`.
Not to fix a type error. Not to update a dependency. Not to correct something that is
genuinely wrong. If a change outside `rayssa/` appears necessary, stop and ask — do not make
it and mention it afterwards.

The three exceptions are the one-time build-isolation commit described in spec section 3.6
(`tsconfig.json` exclude, `eslint.config.mjs` ignore, `.gitignore`), which the owner applies
before your first session. After that commit, `rayssa/` is your entire writable surface.

**Never import across the boundary.** No `import … from "../lib/..."`. The two applications
have separate dependency trees and separate builds. Port the code you need into `rayssa/`
instead — that is what spec section 9 means by reuse.

Every pull request you open must show changes to `rayssa/` and nothing else. If `git diff
--name-only` lists a path outside `rayssa/`, the pull request is wrong regardless of whether
the tests pass.

## This is NOT the Next.js you may know

This version has breaking changes — APIs, conventions, and file structure may differ from
your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
routing or data-fetching code. Heed deprecation notices.

## Hard prohibitions

Violating any of these can end a client's revenue-generating social account. They are not
tradeoffs.

1. **No browser automation of any platform.** No Playwright, Puppeteer, Selenium, headless
   Chrome, or userscript that logs into X, Reddit, TikTok, Instagram, or OnlyFans. All of
   them prohibit it and the ban lands on the client, not on us.
2. **No OnlyFans integration.** No API, no third-party "OnlyFans API" vendor, no scraping.
   Never store an OnlyFans password, session cookie, or 2FA seed. Usernames and operational
   notes only.
3. **No automated sending.** No AI-written message reaches a fan or a prospect without a
   human pressing send. We draft; a person sends.
4. **No cold DMs through any API.** Instagram's messaging API is a 24-hour reply window, not
   an outreach channel.
5. **No identical title and media across multiple subreddits.** That is the spam signature.
6. **No "publish everywhere" button.** Do not build a UI affordance implying automation that
   does not exist.

If a task seems to require one of these, stop and ask. Do not find a clever way around it.

## Never invent data the agency must supply

Subreddit names, subreddit rules, karma thresholds, cooldowns, brand profiles, and example
copy come from files the owner provides. If the file is missing or a column is empty, leave
it null and say so. **Do not generate plausible-looking substitutes.** Invented subreddit
rules get real accounts banned, and they are indistinguishable from real ones once they are
in the database.

Fake *models* for local development are the one exception, and only in the dev seed script.

## Database rules

- **All RAYSSA tables live in the `rayssa` schema.** Never `public`. `public` belongs to the
  separate KARAY application and a collision there hits a live production system.
- **Read KARAY data only through views in `rayssa`, always with `security_invoker = true`.**
  Without it the view bypasses the caller's row-level security.
- **Never create a view exposing earnings, payments, identity documents, proxy credentials,
  or notes.** RAYSSA has no use for them. A view that does not exist cannot leak.
- **RAYSSA never writes to `public`** except ticking the daily checklist, and that goes
  through a narrow `security definer` function — not a table grant.
- **RLS on every table, from the first migration.** Not "added at the end." Follow the
  predicate-helper pattern in the KARAY repository's existing migrations.
- **`revoke all … from anon` on every table.** Every one.
- Migrations carry a header comment saying what and why. `security definer set search_path =
  public` on every function. `drop policy if exists` before every `create policy`.
- **Never apply a migration to production.** Deliver `.sql` in a pull request; the owner
  applies it.

## The media classification gate

Every asset carries a rating: `instagram_tiktok_safe`, `x_reddit_safe`, `onlyfans_only`,
`needs_review` (the default), or `do_not_use`.

**The database must reject any pairing of an asset with a channel its rating does not
permit.** A UI filter is not sufficient — the UI is not the only thing that writes rows. An
`onlyfans_only` asset reaching an Instagram slot ends that account.

Only an `owner` may set a rating. There is no automatic or ML classification. A human rates
every asset.

## Verification

State only what you have verified, and paste the actual command output. If a check was
skipped, say so. A test that asserts what the implementation just did proves nothing —
verify behaviour against the acceptance criteria in section 11 of the spec.

Before opening any pull request:

```
npm run typecheck && npm run lint && npm test && npm run i18n:check
```

All four must pass. Include the Supabase security-advisor output showing no new warnings.

## Internationalisation

Every user-facing string goes through `next-intl`, in both `pt-BR` and `en-US`. No hardcoded
copy in components. `npm run i18n:check` enforces this and runs in CI.

## Secrets

Commit `.env.example` with names and comments only. Never a value. Never a real key in code,
in a test fixture, in a comment, or in a commit message.

## Scope

Implement the phase you were asked for and stop. The build order in section 12 exists
because later phases depend on earlier ones being correct — the media gate (Phase 3) must
exist before anything selects an asset. Do not work ahead.
