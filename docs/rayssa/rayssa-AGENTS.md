<!--
  Copy this file to the ROOT of the `rayssa` repository as `AGENTS.md`.
  Read by Claude Code, Windsurf, Devin, and Cursor alike.
-->

# AGENTS.md — RAYSSA

## You are joining a project already in progress

Multiple AI agents work on this repository in relay. You are almost certainly not the first.
**Do not scaffold, do not re-initialise, do not "set up the project."** It is already set up.

**Your first three actions, before writing any code:**

1. Read `PROJECT_BRIEF.md` — the full specification. What we are building and, just as
   importantly, what is prohibited. It does not change.
2. Read `HANDOFF.md` — where the previous agent stopped. Overwritten constantly.
3. Run `git log --oneline -20` and `git status`. **If `HANDOFF.md` and the git history
   disagree, the code wins** — correct `HANDOFF.md` before continuing.

Then begin at the first item under "Next 3 steps" in `HANDOFF.md`.

If `HANDOFF.md` does not exist, you are the first agent. Start from `PROJECT_BRIEF.md`
section 12 (build order), Phase 1, and create `HANDOFF.md` as described below.

---

## RAYSSA is standalone — there is nothing else

This application connects to **no other system**. No shared database, no API to another
service, no synchronisation, no shared credentials, no reference codebase.

- **Never ask for access to another repository.** There isn't one, and a task that seems to
  need one is a task you have misread.
- **Never add an integration to an external system** that is not explicitly specified in
  `PROJECT_BRIEF.md`.
- RAYSSA owns all of its own data, including its model records. Every foreign key points at
  a table in this same database, and Postgres enforces them.

---

## Hard prohibitions

Violating any of these can end a client's revenue-generating social account. They are not
tradeoffs, and there is no clever way around them.

1. **No browser automation of any platform.** No Playwright, Puppeteer, Selenium, headless
   Chrome, or userscript that logs into X, Reddit, TikTok, Instagram, or OnlyFans. All of
   them prohibit it, and the ban lands on the client, not on us.
2. **No OnlyFans integration.** No API, no third-party "OnlyFans API" vendor, no scraping.
   Never store an OnlyFans password, session cookie, or 2FA seed. Usernames only.
3. **No automated sending.** No AI-written message reaches a fan or a prospect without a
   human pressing send. We draft; a person sends.
4. **No cold DMs through any API.** Instagram's messaging API is a 24-hour reply window, not
   an outreach channel.
5. **No identical title and media across multiple subreddits.** That is the spam signature.
6. **No "publish everywhere" button.** Do not build a UI affordance implying automation that
   does not exist.

If a task seems to require one of these, **stop and ask.**

---

## Never invent data the agency must supply

Subreddit names, subreddit rules, karma thresholds, cooldowns, brand positioning, and
example copy come from files the owner provides. If a file is missing or a column is empty,
**leave it null and say so.**

Do not generate plausible-looking substitutes. Invented subreddit rules get real accounts
banned, and once they are in the database they are indistinguishable from real ones.

Sample models in the **dev seed script** are the one exception.

---

## The media classification gate

Every asset carries a rating: `instagram_tiktok_safe`, `x_reddit_safe`, `onlyfans_only`,
`needs_review` (the default), or `do_not_use`.

**The database must reject any pairing of an asset with a channel its rating does not
permit.** A UI filter is not sufficient — the UI is not the only thing that writes rows. An
`onlyfans_only` asset reaching an Instagram slot ends that account.

Only an `owner` may set a rating. There is no automatic or ML classification.

---

## Database rules

- Tables in `public`. `supabase/migrations/` is this database's complete history.
- **RLS on every table from its first migration.** Not "added at the end." The exact pattern
  is in `PROJECT_BRIEF.md` section 9.1 — follow it.
- `revoke all … from anon` on every table. Every one.
- `security definer set search_path = public` on every function.
- `drop policy if exists` before every `create policy`.
- **Never edit a migration that has already run.** Add a new one.
- **Never apply a migration to production.** Deliver the `.sql` in a pull request; the owner
  applies it.

---

## Handoff protocol (mandatory)

Your session can end at any moment — usage limits, a crash, the user closing the window.
Another agent resumes from the pushed branch with zero memory of you. Work accordingly.

### Rule 1 — the branch must always build

Never end a turn with the repo broken. If a change spans several files, finish the whole set
in one turn, or stub the rest with `// TODO(handoff): <what remains>` so it still compiles.

### Rule 2 — overwrite HANDOFF.md before you stop

Any turn that changes code ends by rewriting `HANDOFF.md` completely. It is a snapshot, not
a log. Use exactly this structure:

```
# Handoff — <UTC timestamp> — <agent: Claude Code / Windsurf / Devin>

## Current goal
The specific phase and slice of PROJECT_BRIEF.md being built right now.

## Done
- Verified-complete items only. If you did not run it, it is not done.

## In progress
- The exact task mid-flight and how far it got.
- Name files and functions. "Working on auth" is useless.

## Next 3 steps
1. <written as an instruction to another AI agent, not a note to self>
2. ...
3. ...

## Files touched this session
- path/to/file — what changed and why

## Gotchas
- What a fresh agent would get wrong: env vars that must be set, migrations not yet
  applied, schema assumptions, ordering requirements, things that look broken but aren't.

## Verify
Exact commands that prove the build still works, and their expected output.
```

### Rule 3 — small, shippable increments

One working vertical slice beats five half-finished files. Commit often.

### Rule 4 — assume no memory

Anything you learned that is not in `HANDOFF.md` or the code itself is gone when your
session ends.

### Rule 5 — branch hygiene

Work on `wip/relay`. Never commit directly to `main`.

---

## Verification

State only what you have verified, and paste the actual command output. If a check was
skipped, say so. A test that asserts what the implementation just did proves nothing —
verify against the acceptance criteria in `PROJECT_BRIEF.md` section 11.

Before opening any pull request:

```
npm run typecheck && npm run lint && npm test && npm run i18n:check
```

All four must pass.

---

## Scope discipline

`PROJECT_BRIEF.md` is fixed scope. Implement the phase you were asked for and stop — later
phases depend on earlier ones being correct, and the media gate (Phase 3) must exist before
anything selects an asset.

If you believe something in the brief is wrong or missing, **do not silently change
direction.** Note it under "Gotchas" in `HANDOFF.md` and say so in your reply.

---

## Secrets

Commit `.env.example` with names and comments only. Never a value. Never a real key in code,
in a test fixture, in a comment, or in a commit message.
