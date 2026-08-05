# RAYSSA — Build Prompt

**Read this whole document before writing any code.**

RAYSSA is a **separate platform** from karaymodels.com. Separate repository, separate
deployment, separate domain, password-protected end to end. It reads model data from the
karaymodels Supabase database and writes its own marketing data alongside it. It is never
mounted inside the existing Next.js site, and no part of it is publicly reachable.

This document is the specification. It states what to build, what NOT to build, and why.
The "why nots" are load-bearing — several obvious-looking features would get the agency's
revenue-generating accounts banned, and they are listed as prohibitions rather than left to
judgement.

---

## 0. Vocabulary

| Term | Meaning |
|---|---|
| **KARAY** | The existing agency platform at karaymodels.com. Source of truth for models, representatives, brand profiles, earnings. |
| **RAYSSA** | The new marketing command center. This document. |
| **Model** | A creator the agency manages. Row in `public.models` on KARAY. |
| **Rep** | Representative assigned to a model. Row in `public.profiles` with a representative role. |
| **Packet** | One model's full prepared marketing output for one day, across all channels. |
| **Channel** | X, Reddit, Instagram, TikTok, Outreach, OnlyFans. |
| **Asset** | A photo or video, stored in Google Drive, classified for where it may be published. |

---

## 1. What RAYSSA is

One screen per day per model that answers: *what do we post, where, with what media, and
what happened to yesterday's posts?*

**Scale.** RAYSSA operates on every model where `active = true` — the roster is read from
the database, never hardcoded, and models are added and deactivated without a code change.
Design and load-test for **up to 30 active models**. Nothing may assume a fixed count, and
nothing may degrade non-linearly as the roster grows toward that ceiling: the overnight
preparation job in particular must batch the whole roster in one pass rather than looping
one model at a time (see 7 and 8).

It does three things:

1. **Prepares** — overnight, for every active model, generates the full day's marketing
   packet: captions, titles, hashtags, subreddit selections, outreach targets, DM drafts,
   and the specific approved asset for each slot.
2. **Publishes what can legally be published automatically** — currently Instagram only,
   and only after Meta app review. Everything else goes into a manual action queue with
   copy-to-clipboard and deep links.
3. **Measures** — tracked links on every outbound post, so the agency learns which
   subreddit, which collab, and which platform actually produce subscribers, instead of
   only knowing that work was done.

## 2. What RAYSSA is not

**Do not build any of the following. These are not deferred features; they are prohibited.**

- **No browser automation of any platform.** No Playwright, Puppeteer, Selenium, headless
  Chrome, or userscript that logs into X, Reddit, TikTok, Instagram, or OnlyFans on a
  model's behalf. Every one of those platforms prohibits it, and the penalty lands on the
  model's account, not on the tool.
- **No OnlyFans integration of any kind.** OnlyFans has no public API and its terms
  prohibit automated access. RAYSSA never holds an OnlyFans password, session cookie, or
  2FA seed. It stores the account username and operational notes only. Third-party
  "OnlyFans API" resellers exist and many agencies use them; they work by
  reverse-engineering the private API or driving a browser extension, they violate the
  terms either way, and integrating one would put every managed account at risk from a
  single vendor's mistake. If the owner later decides to accept that risk, it is a
  standalone decision made in writing — not something this build assumes.
- **No AI-generated messages sent automatically to fans.** RAYSSA drafts; a human sends.
- **No cold DMs sent through any API.** Instagram's messaging API is a reply channel with a
  24-hour window after a user messages the business account. It is not a cold-outreach tool
  and must not be used as one.
- **No posting the same title and media to five subreddits at once.** That is the exact
  signature of spam detection.
- **No "one-click publish everywhere" button.** It cannot exist honestly. Do not build a
  UI affordance that implies it does.

---

## 3. Architecture

### 3.1 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (match KARAY's major version — read `node_modules/next/dist/docs/` before writing routing or data-fetching code; the conventions differ from older releases) |
| Language | TypeScript, strict |
| UI | Tailwind v4, React 19, `react-icons` — mirror KARAY's component idiom |
| i18n | `next-intl`, locales `pt-BR` and `en-US`, same message-catalogue layout as KARAY |
| Database | Supabase — **the same project as KARAY** (see 3.3) |
| Auth | Supabase Auth, email + password, allowlist-gated |
| Media | Google Drive (service account), same pattern as KARAY's nightly backup |
| LLM | Anthropic API, `@anthropic-ai/sdk` |
| Scheduler | Supabase `pg_cron` + `pg_net` (see 3.5) |
| Hosting | Vercel Pro (see 3.2) |
| Source control | GitHub — a sibling `rayssa/` app inside the karaymodels repository (see 3.6) |

### 3.2 Hosting — read this before choosing

Vercel's Hobby plan is restricted to non-commercial personal use; commercial deployments
require Pro or Enterprise. This is stated in Vercel's own plan documentation and terms, and
RAYSSA is unambiguously commercial. Enforcement is inconsistent, but Vercel reserves the
right to disable a Hobby project without notice, and losing the agency's operations
dashboard without warning is not an acceptable risk to carry for $20/month.

**Recommendation: Vercel Pro, $20/month.** One seat covers the whole agency. It keeps
`vercel.json` cron, the deployment model, and the framework behaviour identical to KARAY,
which is worth far more than $20 in avoided divergence.

**If the requirement is a hard $0:** Cloudflare Pages + Workers permits commercial use on
the free plan, and Next.js deploys there via `@opennextjs/cloudflare`. Budget real time for
runtime differences. Write the app so hosting is swappable: keep all scheduled work behind
`POST /api/cron/*` routes guarded by a shared secret, so the trigger can come from Vercel
Cron, Cloudflare Cron Triggers, or Supabase `pg_cron` without touching business logic.

Supabase's free tier has no non-commercial restriction. Its limits (500 MB database, 5 GB
egress, 1 GB storage) are the real constraint, and keeping media in Drive rather than
Supabase is what keeps RAYSSA inside them.

### 3.3 Data access — same Supabase project, isolated by schema

RAYSSA needs the model roster, brand profiles, rep assignments, and daily-checklist state
that KARAY already owns. Do **not** build an HTTP API between the two apps and do **not**
stand up a second database that syncs.

- A second database means a sync job, and a sync job means RAYSSA is always showing
  yesterday's roster and silently diverging the moment the job fails.
- An HTTP API between two apps the same owner controls is a serialization layer with
  authentication bolted on, invented to solve a problem that row-level security already
  solves.

**Build it this way instead:**

1. RAYSSA points at the **same Supabase project** — same `NEXT_PUBLIC_SUPABASE_URL`, same
   anon key. Different app, different domain, same database.
2. All RAYSSA tables live in a dedicated `rayssa` schema, never in `public`. This keeps the
   two apps' migrations from colliding and makes the boundary auditable.
3. RAYSSA reads KARAY data through **read-only views** in the `rayssa` schema, not by
   selecting from `public.models` directly. Create exactly the views RAYSSA needs:

   ```sql
   create schema if not exists rayssa;

   create or replace view rayssa.model_roster
     with (security_invoker = true) as
   select
     m.id,
     m.stage_name,
     m.status,
     m.active,
     m.representative_id,
     m.daily_percentage
   from public.models m
   where m.active;
   ```

   `security_invoker = true` is required. Without it the view runs as its owner and
   bypasses the caller's RLS — silently handing RAYSSA users rows that KARAY's policies
   deny them.

   Add similar views for brand profiles (niches, positioning, voice, target audience,
   markets to avoid) and social accounts. **Never create a view exposing earnings,
   payments, personal documents, proxy credentials, or `notes`.** RAYSSA has no business
   with any of them, and a view that does not exist cannot leak.

4. RAYSSA **never writes to `public`.** Every write goes to a `rayssa.*` table. The one
   permitted exception is ticking `public.model_daily_checklist_items` when a channel task
   completes, so the DAILY badge on KARAY's `/admin/models` stays truthful — and that goes
   through a `security definer` function with a narrow signature, not a direct table grant.

If the agency ever hires an outside developer for RAYSSA who must not see KARAY's data at
all, revisit this: at that point a separate project plus a read API becomes worth its cost.
Until then it is expense without benefit.

### 3.4 Auth and users

The KARAY and RAYSSA apps share one `auth.users` pool, so every model and rep with a KARAY
login technically has credentials that reach RAYSSA's domain. Gate on top of that:

```sql
create table rayssa.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('owner','operator')),
  locale      text not null default 'pt-BR' check (locale in ('pt-BR','en-US')),
  must_change_password boolean not null default true,
  active      boolean not null default true,
  invited_by  uuid references rayssa.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
```

- **Middleware rule:** every route except `/login` requires a session whose `auth.uid()`
  has an `active` row in `rayssa.users`. A model or rep who logs in with valid KARAY
  credentials but has no RAYSSA row gets a clean "no access" page — never a partial
  dashboard, never a 500.
- **Every `rayssa.*` table gets RLS**, with policies keyed on `rayssa.is_rayssa_user()` and
  `rayssa.is_rayssa_owner()` — the same helper-predicate pattern KARAY uses. `revoke all
  … from anon` on every table, exactly as KARAY's migrations do.
- **Roles:** `owner` can create and deactivate users and delete records. `operator` can do
  everything else. Both seed users are `owner`.
- **Seed users** — create through the Supabase admin API in a one-off script, never in a
  committed migration and never with the password in the repository:

  | Name | Role | Temporary password |
  |---|---|---|
  | Kartel West | owner | `West1234` |
  | Raissa Vieira | owner | `Eira1234` |

  Both are last-four-letters-of-surname + `1234`, as specified. Both rows are created with
  `must_change_password = true`, and middleware forces a redirect to `/change-password`
  until it is cleared. Rotate both immediately after first login — they have been written
  down in a spec file and a chat log, which means they are already compromised for any
  purpose stronger than first-run.
- **No public signup.** The only way to create a user is an owner inviting one from
  `/settings/users`.
- Add rate limiting on `/login` (5 attempts per IP per 15 minutes) and enable Supabase's
  leaked-password protection.

### 3.5 Scheduler

Do not add a fourth vendor. The project is already on Supabase; `pg_cron` and `pg_net` are
available on the free tier and run inside the database that holds the data.

```sql
select cron.schedule(
  'rayssa-prepare-daily',
  '0 7 * * *',                         -- 04:00 America/Sao_Paulo
  $$ select net.http_post(
       url     := 'https://rayssa.karaymodels.com/api/cron/prepare-daily',
       headers := jsonb_build_object(
         'Content-Type',  'application/json',
         'Authorization', 'Bearer ' || current_setting('app.rayssa_cron_secret')
       )
     ) $$
);
```

The endpoint rejects any request without the matching `CRON_SECRET`, same as KARAY's
existing ledger and backup crons. Keep every scheduled job behind such a route so the
trigger source stays swappable.

### 3.6 Repository layout — one repo, two applications

RAYSSA lives **in the karaymodels repository**, as a sibling application with its own
dependency tree and its own build. It is not a route inside the existing app.

**The reason is the database, not the convenience.** Section 3.3 puts RAYSSA and KARAY on
one Supabase project. A Postgres database has exactly one schema history, and
`supabase/migrations/` is the file that records it. Split across two repositories, two
migration directories apply to one database and neither knows what the other has run:
timestamps interleave in ways no checkout reflects, `supabase migration list` disagrees with
reality, drift detection is meaningless, and rolling back means reconstructing the true
order by hand from two histories. That is not a process problem to be managed carefully —
it is a structurally broken setup, and the failure surfaces as a production migration that
half-applies.

One repository makes `supabase/migrations/` a single ordered timeline for the one database
that exists. The code-reuse benefits below are real but secondary; this is the load-bearing
argument.

```
karaymodels/                 ← repository root
├── app/                     ← the existing marketing site + admin. UNCHANGED.
├── lib/  components/  i18n/  messages/  supabase/
├── proxy.ts                 ← the existing app's request interception
├── package.json             ← the existing app's dependencies
├── tsconfig.json
└── rayssa/                  ← RAYSSA. Self-contained.
    ├── app/
    ├── lib/  components/  i18n/  messages/
    ├── proxy.ts             ← RAYSSA's own auth gate
    ├── package.json         ← RAYSSA's own dependencies
    ├── tsconfig.json
    ├── next.config.ts
    └── AGENTS.md
```

**Nesting RAYSSA as routes inside the existing app (`app/rayssa/*`) is explicitly rejected.**
Directory depth provides no isolation in a Next.js application. Routes under `app/` share one
`package.json`, one build, one deployment, one `next.config.ts`, one i18n configuration, and
— most sharply — **one request-interception file**, since Next.js permits a single `proxy.ts`
per application. Under that layout a TypeScript error in RAYSSA fails the karaymodels
production build, a RAYSSA deployment redeploys the public marketing site, and RAYSSA's
authentication gate has to be merged into the same file that serves the public site's
requests. That is the opposite of separation.

The sibling layout gives real isolation because **Vercel's Root Directory setting points a
project at a subdirectory**:

| Vercel project | Root Directory | Domain | Deploys |
|---|---|---|---|
| `karaymodels` | `.` | karaymodels.com | The existing site, unchanged |
| `rayssa` | `rayssa/` | rayssa.karaymodels.com | RAYSSA only |

Two builds, two deployments, two sets of environment variables, two `proxy.ts` files. A
RAYSSA build failure cannot break karaymodels.com, because karaymodels.com's build never
compiles RAYSSA's code.

**Three edits to the existing repository are required — and they are the only ones.** Without
them the root build type-checks and lints `rayssa/`, which reintroduces the coupling the
layout exists to prevent:

1. `tsconfig.json` — add `"rayssa"` to `exclude`:
   ```json
   "exclude": ["node_modules", "rayssa"]
   ```
2. `eslint.config.mjs` — add `"rayssa/**"` to the `globalIgnores([...])` list.
3. `.gitignore` — add `rayssa/node_modules` and `rayssa/.next`.

Make these three edits in their own commit, before any RAYSSA code is written, and confirm
`npm run typecheck && npm run lint && npm test && npm run build` still passes at the root.
**Nothing else in the existing application may be modified at any point in this build.**

**Migrations are the one exception to the `rayssa/` boundary.** RAYSSA's migrations go in the
**root** `supabase/migrations/` directory alongside KARAY's — that is the whole point of the
single timeline above. There is no `rayssa/supabase/` directory. Two rules make this safe:

- **Only ever add new timestamped files.** Appending a migration cannot affect KARAY.
- **Never edit, reorder, or delete an existing migration.** Those have already run against
  production; changing one silently desynchronises the recorded history from the real schema.

Name RAYSSA's migrations so the boundary is legible at a glance —
`20260812000000_rayssa_users.sql`, `20260813000000_rayssa_assets.sql` — and keep every object
they create inside the `rayssa` schema, except the one `security definer` checklist function
described in 3.3.

**Do not import across the boundary.** RAYSSA must never `import` from `../lib/...`. The two
applications have separate dependency trees and separate builds; a cross-boundary import
couples them again and breaks both. Where the spec says to reuse KARAY code — section 9 —
that means *read it and port a copy into `rayssa/`*, not import it. If the duplication later
becomes painful, extract the shared code into a proper workspace package deliberately; do not
arrive there by accident through a relative import.

---

## 4. The channel matrix

This is the core of the design. Build exactly this — no more automation, no less.

| Channel | Generate | Publish | Why |
|---|---|---|---|
| **Instagram** | Auto | **Auto**, after Meta app review | Instagram's Content Publishing API supports images, video, and Reels for Business/Creator accounts, at up to 100 API posts per account per rolling 24 hours. Legitimate and supported. |
| **X / Twitter** | Auto | **Manual** by default; optional paid auto | See 4.2 — the free tier is gone and per-post pricing makes automation a real line item. |
| **TikTok** | Auto | **Manual** | TikTok's Content Posting API restricts unaudited apps to private-only posts, and its Direct Post terms explicitly exclude internal tools that upload to accounts you or your team manage. |
| **Reddit** | Auto (selection + unique titles) | **Manual** | Reddit's API terms require a separate agreement for commercial use and prohibit spam. Promotional posting by an agency is commercial by any reading. |
| **Outreach DMs** | Auto (targets + personalized drafts) | **Manual** | Instagram's messaging API is a 24-hour reply window, not a cold-DM channel. Ten thoughtful messages beat ten obvious bot messages anyway. |
| **OnlyFans** | Auto (post + reply drafts) | **Manual** | No public API; terms prohibit automated access. See 2. |

### 4.1 Instagram — the one genuinely automatic channel

Real, but not free of friction. Build it so it degrades gracefully:

- Requires a Facebook Page linked to an Instagram Business or Creator account, Meta
  Business Verification, and app review for `instagram_content_publish`.
- **App review is a real risk, not a formality.** Meta reviews what the app does and who
  operates it, and Meta's own content policies prohibit sexual solicitation regardless of
  how a post is created. An agency whose purpose is driving traffic to OnlyFans may be
  denied. Budget weeks, and assume it might not land.
- **Therefore: every Instagram feature must work fully in manual-queue mode.** Auto-publish
  is a flag on the social account (`auto_publish_enabled`), default `false`. When it is
  off, Instagram behaves exactly like TikTok — prepare, download, copy caption, deep link,
  paste the resulting URL back. Nothing about the product is blocked on Meta's decision.
- Publish flow: container create → status poll → publish → store the returned media ID,
  permalink, and timestamp. Handle the rate limit by reading Meta's own
  `content_publishing_limit` endpoint before publishing rather than counting locally.

### 4.2 X / Twitter — generate, publish manually, price the alternative honestly

X made pay-per-use the default for new developers in February 2026, closing the flat $200
Basic and $5,000 Pro tiers to new signups and discontinuing the free tier. Current
usage-based rates are **$0.015 per post created**, rising to **$0.20 if the post contains a
URL**, plus $0.005 per post read and $0.010 per user read.

For 3 posts/day with two plain posts and one link CTA, that is roughly $6.90 per model per
month — about **$207/month across 30 models**, before any read operations. That is a real
number, and it is the reason X publishing is manual by default.

So: RAYSSA generates the hook, the preview, and the CTA, picks the approved asset, shows
the three scheduled times, and gives **Copy caption**, **Download media**, and **Open X**.
A human posts. Add a per-account `x_auto_publish_enabled` flag and the API plumbing behind
it, so an individual model earning enough to justify $7/month can be switched on
individually — but ship with it off everywhere.

**Verify these rates at X's developer portal before quoting them to anyone.** Pricing has
changed repeatedly and this figure has a shelf life.

### 4.3 Reddit — build a subreddit intelligence database, not a posting bot

The value here is not automation; it is institutional memory. Reps burn out re-reading
subreddit rules and get models banned by forgetting a cooldown. Store it once:

```sql
create table rayssa.subreddits (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,          -- without r/
  nsfw_allowed          boolean not null default false,
  verification_required boolean not null default false,
  min_account_age_days  integer,
  min_karma             integer,
  links_allowed         boolean not null default false,
  promo_days            text[],                        -- e.g. {wed,sun}
  title_rules           text,
  cooldown_hours        integer not null default 24,
  niches                text[] not null default '{}',
  subscriber_count      integer,
  notes                 text,
  active                boolean not null default true,
  rules_verified_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table rayssa.model_subreddit_state (
  model_id       uuid not null,        -- FK to public.models
  subreddit_id   uuid not null references rayssa.subreddits(id) on delete cascade,
  is_verified    boolean not null default false,
  last_posted_at timestamptz,
  warning_count  integer not null default 0,
  banned         boolean not null default false,
  banned_reason  text,
  primary key (model_id, subreddit_id)
);
```

Daily selection: filter to subreddits matching the model's niches, where the model is
verified if verification is required, where `now() - last_posted_at > cooldown_hours`, and
which are not banned. Pick five. Generate **five different titles** — never the same title
across communities. Rank by historical click-through from the tracked-link data (section
6), so the list gets smarter as it accumulates.

The rep opens each subreddit, confirms the rules still match `title_rules`, posts, pastes
the URL back. `rules_verified_at` older than 90 days renders a "re-check rules" warning —
subreddit rules change and stale rules are how bans happen.

### 4.4 Outreach — automate the research and the writing, never the Send

```sql
create table rayssa.outreach_prospects (
  id             uuid primary key default gen_random_uuid(),
  model_id       uuid not null,
  handle         text not null,
  platform       text not null,
  profile_url    text,
  niche          text,
  follower_range text,
  country        text,
  language       text,
  match_reason   text,             -- why this creator is a good fit
  draft_message  text,
  status         text not null default 'queued'
                 check (status in ('queued','sent','replied','agreed','declined','ghosted')),
  contacted_at   timestamptz,
  follow_up_at   timestamptz,
  notes          text,
  created_by     uuid references rayssa.users(id),
  created_at     timestamptz not null default now(),
  unique (model_id, handle, platform)
);
```

Every draft is individually written against that specific creator: compliment something
specific → explain the mutual fit → propose one concrete simple collaboration → no
pressure. A human opens the profile, reads the draft, edits it, sends it, marks it sent.

Never generate ten variations of one template. The unique constraint prevents re-pitching
the same creator, which is the fastest way to look like a bot.

### 4.5 OnlyFans — an assistant queue, nothing more

RAYSSA produces a suggested feed post with a selected asset, a caption, and a price or
free-post recommendation; plus DM reply drafts for conversations the rep pastes in
manually. The rep copies, edits, sends. RAYSSA records what was posted and when, because
that history is what makes the next day's suggestion better.

Store the account handle and operational notes. **No credentials, ever.**

---

## 5. Media classification — the most important safety feature in the build

A single explicit asset auto-published to Instagram ends that account. This gate is not
optional and must be enforced in the database, not only in the UI.

```sql
create type rayssa.asset_rating as enum (
  'instagram_tiktok_safe',   -- fully clothed, platform-compliant
  'x_reddit_safe',           -- adult content permitted on X and Reddit
  'onlyfans_only',           -- explicit; never leaves OnlyFans
  'needs_review',            -- default on ingest
  'do_not_use'
);

create table rayssa.assets (
  id             uuid primary key default gen_random_uuid(),
  model_id       uuid not null,
  drive_file_id  text not null,
  drive_preview_url text,
  filename       text not null,
  mime_type      text not null,
  is_video       boolean not null default false,
  width          integer,
  height         integer,
  duration_secs  numeric,
  rating         rayssa.asset_rating not null default 'needs_review',
  rated_by       uuid references rayssa.users(id),
  rated_at       timestamptz,
  has_watermark  boolean not null default false,
  tags           text[] not null default '{}',
  created_at     timestamptz not null default now(),
  unique (model_id, drive_file_id)
);
```

Rules, enforced at the database layer:

1. **`needs_review` is the default.** Nothing is publishable until a human rates it. There
   is no automatic classification and no ML shortcut — a false negative here costs an
   account.
2. **Only an `owner` may set a rating.** Not an operator, not the model.
3. **A `check` constraint or trigger on the packet-item table rejects any pairing of an
   asset with a channel its rating does not permit.** Instagram and TikTok slots accept
   only `instagram_tiktok_safe`. X and Reddit slots accept `instagram_tiktok_safe` or
   `x_reddit_safe`. OnlyFans slots accept anything except `do_not_use`. `onlyfans_only`
   must be structurally incapable of reaching an Instagram slot — a UI filter alone is not
   sufficient, because the UI is not the only thing that writes rows.
4. **Vertical check for Reels and TikTok**: warn when `height <= width`.
5. **Watermark check**: warn before TikTok if `has_watermark` is true.
6. Store only Drive file IDs, preview URLs, and metadata. Never upload media into Supabase
   — it is the fastest route to the 1 GB storage cap and the 5 GB egress cap. KARAY already
   has `googleapis` and a Drive service account wired for nightly backups; reuse that
   credential pattern.

Also record usage, so the same photo does not go out three times in a week:

```sql
create table rayssa.asset_usage (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references rayssa.assets(id) on delete cascade,
  channel    text not null,
  used_at    timestamptz not null default now(),
  packet_item_id uuid
);
```

Selection prefers the least-recently-used eligible asset for the channel.

---

## 6. Attribution — build this, it is the highest-value part

Without it, RAYSSA automates *activity*. With it, RAYSSA does *marketing*. This is the one
thing the agency cannot get from any off-the-shelf scheduler, and it is cheap to build.

```sql
create table rayssa.tracked_links (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,        -- short, URL-safe, e.g. 7 chars
  model_id        uuid not null,
  channel         text not null,
  packet_item_id  uuid,
  subreddit_id    uuid references rayssa.subreddits(id) on delete set null,
  prospect_id     uuid references rayssa.outreach_prospects(id) on delete set null,
  destination_url text not null,
  created_at      timestamptz not null default now()
);

create table rayssa.link_clicks (
  id          bigserial primary key,
  link_id     uuid not null references rayssa.tracked_links(id) on delete cascade,
  clicked_at  timestamptz not null default now(),
  ip_hash     text,                 -- salted hash, never the raw address
  user_agent  text,
  country     text,
  referrer    text
);

create index link_clicks_link_time_idx on rayssa.link_clicks (link_id, clicked_at desc);
```

`GET /r/[code]` looks up the destination, writes a click row without blocking, and 302s.
Hash the IP with a server-side salt — store a fingerprint for deduplication, never an
address.

Point tracked links at a landing page the agency owns, which then links to OnlyFans. Two
hops gives a landing-page view *and* a click-through, which is far more signal than a bare
redirect.

**State the limit plainly in the UI:** OnlyFans reports no conversion data back, so RAYSSA
can attribute clicks by source but not subscriptions. Correlate clicks-by-source against
the daily new-subscriber count the rep enters manually. That correlation is imperfect and
the dashboard should say so rather than presenting a number that looks like ground truth.

Rank subreddits, posting times, and collab partners by clicks per post. Surface the bottom
performers as loudly as the top ones — knowing which five subreddits produce nothing is
what frees up twenty-five minutes a day.

---

## 7. Packets and status

```sql
create table rayssa.daily_packets (
  id           uuid primary key default gen_random_uuid(),
  model_id     uuid not null,
  packet_date  date not null,
  status       text not null default 'preparing'
               check (status in ('preparing','ready','partial','failed')),
  prepared_at  timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (model_id, packet_date)
);

create table rayssa.packet_items (
  id            uuid primary key default gen_random_uuid(),
  packet_id     uuid not null references rayssa.daily_packets(id) on delete cascade,
  channel       text not null,
  slot_index    integer not null default 1,      -- X post 1/2/3, subreddit 1..5
  asset_id      uuid references rayssa.assets(id) on delete set null,
  title         text,                            -- Reddit
  body          text,                            -- caption / post text / DM draft
  hashtags      text[],
  subreddit_id  uuid references rayssa.subreddits(id) on delete set null,
  prospect_id   uuid references rayssa.outreach_prospects(id) on delete set null,
  tracked_link_id uuid references rayssa.tracked_links(id) on delete set null,
  scheduled_for timestamptz,
  status        text not null default 'prepared'
                check (status in ('prepared','approved','scheduled','published_auto',
                                  'manual_required','completed_manual','failed','skipped')),
  published_url text,
  published_at  timestamptz,
  completed_by  uuid references rayssa.users(id),
  skip_reason   text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (packet_id, channel, slot_index)
);
```

Every status transition writes an audit row: who, what, when, before, after. Mirror KARAY's
`model_audit_history` pattern rather than inventing a second one.

**Preparation is a batch job over all active models, not a per-model button.** With a roster
in the twenties, a rep must not click "prepare" once per model. The overnight job builds
every packet for every model where `active = true`; the
per-model screen shows a prepared packet and offers a "regenerate this item" action for the
cases where the generated copy misses.

---

## 8. Generation and LLM cost

This is RAYSSA's only meaningful recurring cost, and it is small — but it is not zero and
nobody should be told otherwise.

**Design for cost from the start:** most output is structural. The X post formula, the
Reddit title patterns, the hashtag sets, and the OnlyFans post shapes are templates with
variable slots, and templates cost nothing to fill. Reserve the LLM for the parts where
genuine per-instance writing earns its price:

- The daily hook and CTA angles (fresh, per model, per day)
- Five genuinely distinct Reddit titles
- Ten individually personalized outreach messages
- OnlyFans DM reply drafts

At roughly 3,000 input and 2,500 output tokens per model per day across 30 models:

| Configuration | Approx. monthly |
|---|---|
| Sonnet 5, direct | ~$42 |
| Sonnet 5 + prompt caching + Batch API | ~$20 |
| Haiku 4.5 + prompt caching + Batch API | ~$6 |

Sonnet 5 lists at $3 per million input tokens and $15 per million output (introductory
$2/$10 through 2026-08-31); Haiku 4.5 at $1/$5. The **Batch API halves all token costs** and
is a perfect fit here — packet preparation is an overnight job with no latency requirement,
so submit the whole roster as one batch and collect results before the workday starts. **Prompt
caching** cuts input cost by roughly 90% on cache hits: the system prompt, the brand voice
guidance, and the subreddit rule text are identical across every model in the run, so put
them at the front of the prompt with a cache breakpoint and put the per-model variables
after it. Verify caching is working by checking `usage.cache_read_input_tokens` — if it is
zero across the batch, something volatile has leaked into the prefix.

**Start on Sonnet 5 with batching and caching (~$20/month).** Test Haiku 4.5 on the
template-adjacent generations; keep Sonnet for outreach messages, where the quality
difference shows most and the volume is lowest.

Portuguese and English: generate in the model's `defaultLanguages[0]`. KARAY's
`lib/brand/ai/contentStudio.ts` already does exactly this, with brand profile, niches,
positioning, voice, target demographics, and markets-to-avoid all threaded into the prompt.
**Port that file rather than writing a new prompt from scratch** — including its system
prompt's explicit refusal to generate sexual content or fabricate personal experiences,
which is what keeps the Instagram-bound output publishable.

---

## 9. Reuse — read this before designing a schema

**KARAY has already built most of this.** Migration
`supabase/migrations/20260725000001_amplia_brand_growth_schema.sql` (1,436 lines) defines,
among others: `social_accounts`, `social_account_tokens`, `social_account_connections`,
`content_assets`, `asset_usage`, `content_items`, `content_versions`, `content_approvals`,
`publishing_jobs`, `publishing_attempts`, `content_calendar_entries`, `platform_metrics`,
`content_metrics`, `daily_account_metrics`, `automation_rules`, `automation_runs`,
`alerts`, `prompt_templates`, `prompt_versions`, `ai_generations`, `integration_events`,
`audit_logs`, and `daily_ai_directives` — plus the enums `platform`, `content_status`,
`content_type`, `automation_mode`, and `content_source`.

`20260725000002_amplia_admin_only_rls.sql` already locks all of it to staff.

`lib/brand/ai/contentStudio.ts` and `lib/brand/ai/launchPacket.ts` already generate
platform-specific content from a brand profile using the Anthropic SDK.
`lib/daily/definition.ts` already encodes the entire daily routine as 11 sections of
permanent keys, and `20260805030000_daily_marketing_checklist.sql` already tracks per-model
completion with a trigger-maintained percentage.

**Before writing a single `create table`, read all of it.** Then decide, per table, whether
RAYSSA extends what exists or genuinely needs something new. The tables specified in this
document (`subreddits`, `model_subreddit_state`, `outreach_prospects`, `tracked_links`,
`link_clicks`, `assets` with the rating enum, `daily_packets`, `packet_items`) are the ones
that plausibly do not exist yet. Everything else is very likely already built, tested, and
RLS'd — reinventing it would cost weeks and produce two schemas that drift.

Match KARAY's migration conventions exactly: a header comment explaining what and why,
`security definer set search_path = public` on every function, explicit
`grant`/`revoke` per role, `revoke all … from anon`, and a `drop policy if exists` before
every `create policy`.

---

## 10. Screens

1. `/login` — email + password, bilingual, rate-limited. No signup link.
2. `/` — today across all models: a table of model, DAILY %, packet status, and per-channel
   status chips. Sorted with the models needing action at the top.
3. `/model/[id]` — the day's packet, one section per channel. Each item shows the caption,
   the selected asset preview, the tracked link, and its action buttons. Instagram shows
   **Publish** when auto-publish is enabled; every other channel shows **Copy caption**,
   **Download media**, **Open <platform>**, and a **Paste URL → mark complete** input.
4. `/model/[id]/assets` — the media library with its ratings. Owner-only rating controls.
   Drive sync button. Prominent filter by rating.
5. `/subreddits` — the intelligence database. Editable. Stale-rules warnings.
6. `/outreach` — the prospect pipeline as a kanban across the status values.
7. `/insights` — clicks by channel, by subreddit, by time of day, by collab partner. Best
   and worst performers side by side. The OnlyFans-attribution caveat stated on the page.
8. `/settings/users` — owner-only invitations and deactivation.
9. `/settings/accounts` — social account connections, token status, per-account auto-publish
   flags.

Every string goes through `next-intl`. No hardcoded copy in components — KARAY already
enforces this with `npm run i18n:check`; port that script and wire it into CI.

---

## 11. Acceptance criteria

The build is not done until every one of these passes:

1. An anonymous request to any route except `/login` and `/r/[code]` returns a redirect to
   login. Verified with `curl`, not just in a browser.
2. A user with valid KARAY credentials but no `rayssa.users` row sees a clean no-access
   page. Not a 500, not a partial dashboard.
3. Both seed users can log in with the temporary passwords and are forced to change them
   before reaching any other route.
4. Every string on every screen renders correctly in both `pt-BR` and `en-US`. `i18n:check`
   passes in CI.
5. **An asset rated `onlyfans_only` cannot be attached to an Instagram or TikTok packet
   item.** Prove this by attempting the insert directly in SQL, bypassing the UI, and
   confirming the database rejects it.
6. An asset rated `needs_review` cannot be attached to any packet item.
7. The overnight job produces a complete packet for every active model, and a failure on
   one model does not prevent the rest of the roster from completing. The failed packet's
   `error` is
   populated and the status is `failed`.
8. Reddit selection never returns a subreddit within its cooldown for that model, never
   returns one where the model is banned, and never returns the same title twice within one
   packet.
9. Clicking a tracked link writes exactly one `link_clicks` row and redirects in under
   300 ms.
10. No table in `rayssa` grants anything to `anon`. Verify by querying
    `information_schema.role_table_grants`.
11. No code path anywhere in the repository stores an OnlyFans credential. Verify by
    grepping the schema and the codebase.
12. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
13. Supabase advisors report no new security or performance warnings.

---

## 12. Build order

Ship in this sequence. Each phase is independently useful, so the agency gets value before
the whole thing is finished.

1. **Foundation** — repo, Next.js, Tailwind, `next-intl` with both catalogues, Supabase
   client, `rayssa` schema, `rayssa.users` and its RLS, login, middleware, forced password
   change, seed script, both users created.
2. **Roster** — the read-only views over KARAY data, the dashboard listing all active
   models with their DAILY %. This alone proves the cross-app data access works.
3. **Assets** — Drive sync, the asset table, the rating UI, and the database-level channel
   gate. **Build this before any generation**, because generation selects assets and the
   gate must exist before anything can select the wrong one.
4. **Generation** — port `contentStudio.ts`, build the packet and packet-item tables, build
   the overnight batch job with prompt caching and the Batch API, render the packet screen.
5. **Manual queues** — copy buttons, download buttons, deep links, paste-URL-to-complete,
   the write-back to `public.model_daily_checklist_items`.
6. **Attribution** — tracked links, the `/r/[code]` route, the click table, the insights
   page. Do this before Instagram: measurement is worth more than one automated channel,
   and it works today without anyone's approval.
7. **Reddit intelligence** — the subreddit database, the selection algorithm, per-model
   state, cooldowns, ranking by click data from phase 6.
8. **Outreach** — the prospect queue, personalized draft generation, the pipeline board.
9. **Instagram auto-publish** — last, because it is gated on Meta app review and everything
   else must already work without it.

Do not skip ahead to phase 9. It is the most exciting piece and the most likely to be
blocked by someone else's decision.

---

## 13. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=          # same project as KARAY
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=

GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ASSETS_ROOT_FOLDER_ID=

META_APP_ID=                       # Instagram publishing
META_APP_SECRET=

X_API_KEY=                         # only if paid X publishing is enabled
X_API_SECRET=
X_BEARER_TOKEN=

SOCIAL_TOKEN_ENCRYPTION_KEY=       # 256-bit hex; encrypts stored OAuth tokens
IP_HASH_SALT=                      # 256-bit hex; salts click-tracking IP hashes
CRON_SECRET=                       # guards /api/cron/*

NEXT_PUBLIC_APP_URL=https://rayssa.karaymodels.com
```

Commit only `.env.example` with the names and explanatory comments. Never a value.

---

## 14. Open decisions for the owner

Answer these before phase 4; they do not block phases 1–3.

1. **Domain.** `rayssa.karaymodels.com`, or a separate domain entirely? A subdomain is
   simpler and shares nothing operationally that matters.
2. **Hosting.** Vercel Pro at $20/month, or the Cloudflare route at $0 plus migration
   effort? Recommendation: Vercel Pro.
3. **X paid publishing.** Ship with it off everywhere, as specified? Or enable it for a
   named set of top-earning models from day one, at roughly $7/model/month?
4. **Which models are in scope at launch** — all active models, or a pilot group of 3–5?
   A pilot is strongly recommended: it surfaces the asset-rating workload, which is the
   real bottleneck, before it is the whole roster deep.
5. **Timezone for the overnight job.** `America/Sao_Paulo` is assumed above.

---

## 15. Cost summary

| Item | Monthly |
|---|---|
| Vercel Pro | $20 |
| Supabase | $0 on free tier; $25 if it outgrows it |
| Google Drive | Existing |
| Anthropic API | ~$20 (Sonnet 5, batched + cached) |
| Instagram API | $0 |
| **Total** | **~$40/month** |
| X auto-publish, if enabled | +$7 per model per month |

The Cloudflare route removes the $20 hosting line at the cost of a migration and ongoing
runtime divergence from KARAY. The LLM line is irreducible without dropping generation
quality, and $20/month against the whole roster is not where cost optimization should start.
