<!--
  Copy this file to the ROOT of the new `rayssa` repository as `AGENTS.md`.
  It is the standing rules an agent reads every session. The full spec lives at
  docs/BUILD-PROMPT.md — read that too, but these rules bind regardless.
-->

# RAYSSA — standing rules

Internal marketing operations platform for a talent agency. The full specification is at
`docs/BUILD-PROMPT.md`, and the integration seam at `docs/API-CONTRACT.md`. **Read both
before writing code.** These rules apply every session and override any instinct to the
contrary.

## Rule zero: this repository is the whole world

RAYSSA is a standalone application with its own Supabase project, its own auth, and its own
migration history. It has **no database connection to karaymodels.com and no access to its
codebase**, and it must never acquire one.

- **Never request access to the karaymodels repository.** The boundary is deliberate.
  Everything you need from it has been exported to `docs/reference/` as read-only material —
  port from it, and ask the owner if something is missing.
- **Never connect to KARAY's database.** There is no connection string for it, and a task
  that seems to need one is a task you have misread.
- **The only seam is the HTTP integration API** in `docs/API-CONTRACT.md`. Two `GET`s and one
  narrow `POST`. Do not add endpoints to it, do not call anything not in the contract, and do
  not change the contract — if v1 is insufficient, say so and stop.
- **Build against the mock.** `KARAY_API_MOCK=true` must be enough to develop, run and test
  every feature. If you find yourself needing a live KARAY to make progress, the mock is
  incomplete — extend the mock. Never ask for production integration credentials.

**Model ids are foreign, and nothing enforces them.** Every reference to a model is
`karay_model_id uuid`, cached in `public.karay_models`, with no cross-database foreign key
and therefore no help from Postgres. Validate on write with a trigger; never delete a model
row because the API stopped returning it — mark `missing_since` and keep everything that
points at it.

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

- **This database is entirely RAYSSA's.** Tables go in `public`; `supabase/migrations/` is
  its complete history. There is no other application in it.
- **Model references are `karay_model_id uuid`** against `public.karay_models`, the local
  cache of the roster. Validate on write with a trigger — no cross-database foreign key
  exists to do it for you.
- **Never delete a cached model** because the integration API stopped returning it. Set
  `missing_since`. Deletion orphans every packet, asset and tracked link that references it.
- **RLS on every table, from the first migration.** Not "added at the end." Follow the
  predicate-helper pattern in `docs/reference/rls-policies.sql`.
- **`revoke all … from anon` on every table.** Every one.
- Migrations carry a header comment saying what and why. `security definer set search_path =
  public` on every function. `drop policy if exists` before every `create policy`.
- **Never apply a migration to production.** Deliver `.sql` in a pull request; the owner
  applies it. This holds even though the database is RAYSSA's own.

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
