# RAYSSA — Handing this to Devin

Supersedes sections A and F of `BEFORE-HANDOFF.md`. Sections B, C, D and E of that document
still apply **unchanged**, and section D applies harder — see 3 below.

---

## What drops away

- **No NDA, no contractor agreement, no copyright assignment.** Devin is a tool you pay
  for; Cognition's terms cover the relationship and the output is yours. Do read their data
  handling once so you know what is retained, because everything below assumes you know
  where your credentials end up.
- **No screen-share walkthroughs.** Review pull requests instead.
- **No estimates to negotiate.** You'll be spending compute credits, not hours.

## What gets stronger

Three things, and they're the whole point of this document.

---

### 1. "I can give it everything" is the one instinct to resist

Do not give Devin production credentials. Not the Supabase service-role key, not DNS, not
the KARAY Anthropic key.

This is not about trust in the way it would be with a person. It's two concrete mechanics:

- **Devin runs in Cognition's cloud.** Every credential you paste lives in a third-party
  environment and its session history. That's a fine place for a key to a database of five
  fake models. It's a poor place for the key to a database holding your models' identity
  documents and earnings.
- **An autonomous agent with write access will eventually use it.** Devin fixing a broken
  migration at 2am can `drop` and recreate a table, reset a schema, or run a destructive
  test against whatever database the connection string points at. It won't be malicious.
  It'll be a plausible-looking recovery step against the wrong target. A human would
  probably pause and ask. Devin's whole value proposition is that it doesn't pause.

Section B of `BEFORE-HANDOFF.md` — separate `rayssa-dev` Supabase project, schema-only
export, migrations delivered as `.sql` in a pull request that you apply — costs nothing and
takes an hour. With an AI coder it goes from good practice to the main thing standing
between an autonomous agent and your production data.

Also, before the first session:

- [ ] **Branch protection on `main`.** Require a pull request. Devin must never merge its
      own work.
- [ ] **Devin gets no production Vercel access.** Dev project only. You promote to prod.
- [ ] **Spend cap on the dev Anthropic key** — $50, as in section C.

---

### 2. Devin will fabricate anything you don't give it

This is the single biggest AI-specific risk in this project, and it's quiet.

A human developer who reaches Phase 7 without a subreddit list emails you and waits. Devin
will generate forty plausible subreddit names with invented karma thresholds, invented
cooldowns, and invented posting rules — formatted correctly, seeded cleanly, passing every
test. It will look completely finished. Your reps will then follow those rules and get
models banned in communities whose actual rules were never checked.

The same applies to brand profiles, to the "what actually works" examples, and to asset
ratings. Every gap in section D of `BEFORE-HANDOFF.md` becomes confident invented content
rather than a blocked task.

**So:**

- [ ] **Have section D data ready before the phase that needs it**, not after. The one-page
      summary at the end of `BEFORE-HANDOFF.md` says which phase needs what.
- [ ] **Tell Devin explicitly, in the task prompt, that seed data must come from a file you
      provide.** The phase prompts below do this.
- [ ] **Spot-check every seeded row against reality.** Pick five subreddits from what Devin
      loaded and open them. If the rules in the database don't match the sidebar, the data
      was invented and the whole table is suspect.

The rule of thumb: anywhere the spec says "the agency supplies this," assume Devin will
supply it instead unless the task prompt forbids it and you verify.

---

### 3. Verify every acceptance criterion yourself — Devin reports success

Devin says a task is complete when it believes it is. Sometimes it's right. It will also
report green after writing a test that asserts the thing it just implemented, which proves
nothing about whether the thing is correct.

The thirteen acceptance criteria in section 11 of the spec are your verification list. Three
of them you should run personally rather than read about:

- **#5 — the media gate.** Ask Devin to give you the raw SQL and run it yourself against
  dev: attempt to attach an `onlyfans_only` asset to an Instagram packet item. The
  *database* must reject it. If it inserts, the build is not done no matter what the
  interface does. This is the test that protects the accounts that make your money.
- **#1 — anonymous access.** `curl` the deployed dev URL for a few routes. Confirm redirect
  to login, not a rendered page.
- **#10 — no `anon` grants.** One query against `information_schema.role_table_grants`.
  Devin can hand you the query; you run it.

Ask for evidence, not assurance: the command, and its actual output pasted back.

---

## Repo setup — do this before session one

Devin burns compute discovering a broken toolchain, and a repo where `npm test` doesn't run
produces sessions that end in "I couldn't verify the change."

- [ ] **Scaffold the repo yourself first**, or make Phase 1 a single narrow session whose
      only job is a working skeleton: Next.js + TypeScript + Tailwind + `next-intl`, and
      `npm run dev`, `build`, `typecheck`, `lint`, `test` all exiting clean on an empty app.
      Merge that before anything else starts.
- [ ] **Put `BUILD-PROMPT.md` in the new repo** at `docs/BUILD-PROMPT.md`. Devin reads files
      in the repo far more reliably than long pasted prompts, and it can re-read a file in a
      later session.
- [ ] **Add `AGENTS.md` at the repo root** — see `rayssa-AGENTS.md` in this folder, copy it
      across. Devin reads it every session. The 800-line spec it will not re-read; a
      100-line standing-rules file it will.
- [ ] **Give Devin read access to the karaymodels repository.** Section 9 of the spec is
      where most of the time savings are, and Devin is genuinely good at reading an existing
      codebase when pointed at exact paths. The phase prompts below name the files.
- [ ] **Load the standing rules into Devin's Knowledge / playbook** if your plan has it —
      the prohibitions, the migration conventions, the RLS pattern. Same content as
      `AGENTS.md`. Belt and braces.

---

## Run it as nine sessions, not one

Do not open a session and say "build RAYSSA." Long autonomous runs on an underspecified
goal are where Devin drifts, and you'll pay for the drift twice — once in credits, once in
review.

One phase per session. Each phase in the spec is independently useful and independently
reviewable. Merge before starting the next.

### Phase prompts

Paste these one at a time. Each assumes `docs/BUILD-PROMPT.md` and `AGENTS.md` are in the
repo.

**Phase 1 — foundation**
> Read `docs/BUILD-PROMPT.md` in full, then `AGENTS.md`. Implement Phase 1 only (section 12):
> Next.js scaffold, Tailwind, `next-intl` with both `pt-BR` and `en-US` catalogues, Supabase
> client, the `rayssa` schema, `rayssa.users` with RLS, login, middleware, forced password
> change. Also write a seed script creating 5 fake models and brand profiles in the dev
> database — invent the fake model data, that is the one place invention is correct.
> Do not implement any later phase. Acceptance criteria 1, 2, 3, 4, 12 must pass; paste the
> actual command output for each.

**Phase 2 — roster**
> Implement Phase 2 only. Create the read-only views over KARAY data described in section
> 3.3 — every view must use `security_invoker = true`, and do not create views exposing
> earnings, payments, documents, proxy details, or notes. Build the dashboard listing active
> models with their DAILY percentage.

**Phase 3 — assets and the media gate**
> Implement Phase 3 only: Drive sync, the assets table with the rating enum, the rating UI
> (owner-only), and the channel gate from section 5. The gate must be enforced by a database
> constraint or trigger, not only in the UI. Then demonstrate acceptance criterion 5 by
> running the SQL insert directly and pasting the rejection error.

**Phase 4 — generation**
> Implement Phase 4 only. Read `lib/brand/ai/contentStudio.ts` and
> `lib/brand/ai/launchPacket.ts` in the karaymodels repository and port them rather than
> writing new prompts. Build `daily_packets` and `packet_items`, and the overnight batch job
> using the Anthropic Batch API with prompt caching as described in section 8. Report
> `usage.cache_read_input_tokens` from a real run to prove caching is working.

**Phase 5 — manual queues**
> Implement Phase 5 only: copy buttons, download buttons, platform deep links,
> paste-URL-to-complete, and the write-back to `public.model_daily_checklist_items` through
> a narrow `security definer` function. Do not grant RAYSSA direct write access to any
> `public` table.

**Phase 6 — attribution**
> Implement Phase 6 only: tracked links, the `/r/[code]` route, the click table with salted
> IP hashing, and the insights page. Acceptance criterion 9 must pass.

**Phase 7 — Reddit intelligence**
> Implement Phase 7 only. **Seed the subreddits table only from the CSV I am providing — do
> not invent subreddit names, rules, karma thresholds, or cooldowns.** If the CSV is missing
> a column, leave it null and tell me. Then build the selection algorithm and the cooldown
> logic. Acceptance criterion 8 must pass.

**Phase 8 — outreach**
> Implement Phase 8 only: the prospect queue, personalized draft generation, the pipeline
> board. Each draft must be individually written against that specific creator — do not
> generate variations of a single template.

**Phase 9 — Instagram auto-publish**
> Only start this if I confirm Meta app review has been approved. Implement Phase 9:
> container create, status poll, publish, store media ID and permalink. `auto_publish_enabled`
> defaults to false per account, and every Instagram feature must still work fully in
> manual-queue mode when it is off.

---

## What Devin cannot do

These stay yours no matter how capable the tool is:

- Meta Business Verification and app review submission — business identity, not code
- Converting Instagram accounts to Business/Creator
- The subreddit intelligence
- Filling in brand profiles on KARAY
- Rating assets
- Choosing hosting, domain, launch scope
- Applying migrations to production

The last one is a choice, not a limitation. Keep it that way.
