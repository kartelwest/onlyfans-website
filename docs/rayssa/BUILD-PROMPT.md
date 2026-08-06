# RAYSSA — Build Prompt

**Read this whole document before writing any code.**

RAYSSA is a **fully separate platform** from karaymodels.com: its own repository, its own
Supabase project, its own deployment, its own domain, password-protected end to end. Nothing
it does can reach karaymodels.com's database. It obtains the model roster and brand profiles
through a small read-only API that KARAY exposes (see 3.3), and owns everything else itself.

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
| **Model** | A creator the agency manages. Owned by KARAY; reaches RAYSSA through the integration API and is cached locally in `public.karay_models`. |
| **Rep** | Representative assigned to a model. Lives in KARAY. RAYSSA reads the assignment, never the person's record. |
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
| Database | Supabase — **RAYSSA's own project**, separate from KARAY's (see 3.3) |
| Auth | Supabase Auth — RAYSSA's own instance. No KARAY credential reaches it (see 3.4) |
| Media | Google Drive (service account), same pattern as KARAY's nightly backup |
| Integration | Read-only HTTP API exposed by KARAY, frozen in `docs/rayssa/API-CONTRACT.md` |
| LLM | Anthropic API, `@anthropic-ai/sdk` |
| Scheduler | Supabase `pg_cron` + `pg_net` (see 3.5) |
| Hosting | Vercel Pro (see 3.2) |
| Source control | GitHub — a separate private repository, `rayssa` (see 3.6) |

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

### 3.3 Data access — separate database, read-only integration API

**RAYSSA has its own Supabase project.** It does not share KARAY's. The two systems have
separate databases, separate auth, separate migration histories, and separate failure
domains: nothing RAYSSA does — a bad migration, a runaway insert, a filled disk — can reach
karaymodels.com's data.

That isolation is bought, not free. RAYSSA still needs the model roster and the brand
profiles, and getting them across a database boundary costs three things. Build all three
deliberately.

#### The integration API (lives in the KARAY codebase)

KARAY exposes a small, versioned, read-only API that only RAYSSA calls:

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/integrations/rayssa/v1/models` | Active model roster |
| `GET` | `/api/integrations/rayssa/v1/models/:id/brand-profile` | Niches, positioning, voice, targeting |
| `POST` | `/api/integrations/rayssa/v1/models/:id/checklist` | Tick one daily-checklist item |

Rules for these endpoints, all non-negotiable:

- **Bearer token auth** via `RAYSSA_INTEGRATION_TOKEN`, compared in constant time. Reject
  with 401 and log every failure. Rotate the token on any suspicion.
- **Read-only except the one checklist write**, which is idempotent — the same call twice
  must not double-count.
- **They return only what the contract lists.** Never earnings, payments, identity
  documents, proxy credentials, phone numbers, addresses, or `notes`. A field that is not in
  the contract is not in the response, and the endpoints select explicit columns rather than
  `select *` — so a new sensitive column added to KARAY later cannot silently start
  flowing out.
- **Rate limited**, and every request logged with timestamp, endpoint, and outcome.
- The response shape is frozen in `docs/rayssa/API-CONTRACT.md` and both sides code against
  it. Changing it is a `v2` path, never an edit to `v1`.

**These endpoints are written in the karaymodels repository by the owner, not by RAYSSA's
implementer.** That is what keeps the isolation real — see 3.6.

#### The local cache (lives in RAYSSA's database)

RAYSSA must not call KARAY on every page render. If it did, karaymodels.com going down
would take RAYSSA with it, and every screen would carry a network round trip. Instead
RAYSSA syncs the roster into its own table:

```sql
create table public.karay_models (
  karay_model_id  uuid primary key,          -- KARAY's id. NOT a foreign key.
  stage_name      text not null,
  status          text,
  active          boolean not null default true,
  brand_profile   jsonb,                     -- as returned by the contract
  synced_at       timestamptz not null default now(),
  missing_since   timestamptz                -- set when KARAY stops returning it
);
```

- Sync every 15 minutes, and immediately before the overnight preparation job.
- **Every screen that reads model data shows `synced_at` when it is more than an hour old.**
  Stale data that announces itself is a manageable problem; stale data that looks fresh is
  how someone posts for a model who was deactivated yesterday.
- **A model that stops appearing in the API is marked `missing_since`, never deleted.**
  Deleting would orphan every packet, asset, and tracked link that references it.
- If a sync fails, keep the last good data, raise an alert, and keep serving. Never blank
  the roster because one request timed out.

#### No foreign keys across the boundary

Every RAYSSA table references a model by `karay_model_id uuid` — a plain column with an
index, **not** a foreign key, because the target lives in a different database. Postgres
therefore enforces nothing here. Two consequences to handle explicitly:

- **Validate on write.** Before inserting any row carrying a `karay_model_id`, confirm it
  exists in `public.karay_models`. A trigger is the reliable place for this; application-level
  checks get bypassed by the next code path someone adds.
- **Reconcile weekly.** A scheduled job reports rows referencing models that are
  `missing_since` or absent entirely. It reports; it does not delete. Deletion is a human
  decision.

This is the price of the separation, and it is worth naming plainly: you are trading
Postgres-enforced referential integrity for a hard blast-radius boundary between the two
systems. The trigger and the reconciliation job are what keep that trade honest.

### 3.4 Auth and users

RAYSSA has its own Supabase Auth instance. No KARAY user — no model, no representative —
has any credential that reaches RAYSSA. There is no shared `auth.users` pool to gate
against, which makes this simpler than it would otherwise be: if you are not in RAYSSA's
own auth, you do not exist.

```sql
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('owner','operator')),
  locale      text not null default 'pt-BR' check (locale in ('pt-BR','en-US')),
  must_change_password boolean not null default true,
  active      boolean not null default true,
  invited_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
```

- **Middleware rule:** every route except `/login` and `/r/[code]` requires a session whose
  `auth.uid()` has an `active` row in `public.users`. Anything else gets a clean no-access
  page — never a partial dashboard, never a 500.
- **Every table gets RLS**, keyed on `public.is_active_user()` and `public.is_owner()`
  helper predicates. Follow the pattern in KARAY's `20260722000002_rls_policies.sql`, which
  is a good implementation of exactly this. `revoke all … from anon` on every table.
- **Roles:** `owner` creates and deactivates users and deletes records. `operator` does
  everything else. Both seed users are `owner`.
- **Seed users** — created through the Supabase admin API in a one-off script, never in a
  committed migration and never with the password in the repository:

  | Name | Role | Temporary password |
  |---|---|---|
  | Kartel West | owner | `West1234` |
  | Raissa Vieira | owner | `Eira1234` |

  Both are last-four-letters-of-surname + `1234`, as specified. Both rows are created with
  `must_change_password = true`, and middleware redirects to `/change-password` until it is
  cleared. **Rotate both immediately after first login** — they have been written down in a
  specification file, which means they are already unsuitable for anything beyond first run.
- **No public signup.** The only way to create a user is an owner inviting one from
  `/settings/users`.
- Rate limit `/login` (5 attempts per IP per 15 minutes) and enable Supabase's leaked-password
  protection.

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

### 3.6 Repository layout — a separate repository

RAYSSA is its own GitHub repository, `rayssa`, private. It shares no code, no build, no
deployment, and no database with karaymodels.

| | karaymodels | rayssa |
|---|---|---|
| Repository | `kartelwest/onlyfans-website` | `kartelwest/rayssa` |
| Supabase project | KARAY production | RAYSSA production |
| Vercel project | karaymodels.com | rayssa.karaymodels.com |
| Migrations | `supabase/migrations/` | its own `supabase/migrations/` |
| Auth | KARAY's `auth.users` | RAYSSA's own `auth.users` |

Two independent migration timelines are correct here **because there are two databases.**
Each repository's `supabase/migrations/` is the complete, ordered history of the one database
it owns. (This is the direct consequence of 3.3, and the reason the separate-repository shape
follows from the separate-database decision rather than being an independent choice.)

**The one seam is the integration API in 3.3, and it lives in the karaymodels repository.**
Three route handlers, a token check, and explicit column selection. The RAYSSA implementer
never opens that repository:

- **The owner writes the KARAY-side endpoints** — or has them written in a separate, scoped
  change to karaymodels, reviewed on its own.
- **The RAYSSA implementer codes against `docs/rayssa/API-CONTRACT.md`** and a local mock
  that returns contract-shaped fixtures. RAYSSA must be fully developable and testable with
  KARAY entirely unreachable; if the build ever requires a live KARAY to make progress, the
  mock is wrong.
- **The contract file is copied into both repositories** and they must match byte for byte.
  When it changes, both copies change in the same sitting, or the next drift becomes a
  production bug nobody can reproduce.

#### What you give up, stated plainly

Section 9 of this document lists KARAY code worth reusing — `contentStudio.ts`,
`launchPacket.ts`, the migration conventions, the RLS predicate pattern, the i18n setup.
With separate repositories the implementer cannot read it directly.

**Therefore the owner exports the relevant files into the `rayssa` repository at
`docs/reference/` before the first session**, as read-only reference material:

```
rayssa/docs/reference/
├── contentStudio.ts          # generation prompt structure — port, do not import
├── launchPacket.ts
├── daily-definition.ts       # the 11-section daily routine and its permanent keys
├── rls-policies.sql          # the predicate-helper pattern to follow
├── daily-checklist.sql       # a well-formed migration to imitate
└── README.md                 # "reference only; port, never copy blindly"
```

Without this the implementer writes generation prompts from scratch and reinvents the RLS
conventions, and you lose most of the head start that made this project a one-month build
rather than a three-month one. Copying six files is a ten-minute task that is easy to skip
and expensive to skip.

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
create table public.subreddits (
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

create table public.model_subreddit_state (
  karay_model_id uuid not null references public.karay_models(karay_model_id) on delete cascade,
  subreddit_id   uuid not null references public.subreddits(id) on delete cascade,
  is_verified    boolean not null default false,
  last_posted_at timestamptz,
  warning_count  integer not null default 0,
  banned         boolean not null default false,
  banned_reason  text,
  primary key (karay_model_id, subreddit_id)
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
create table public.outreach_prospects (
  id             uuid primary key default gen_random_uuid(),
  karay_model_id uuid not null references public.karay_models(karay_model_id) on delete cascade,
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
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  unique (karay_model_id, handle, platform)
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
create type public.asset_rating as enum (
  'instagram_tiktok_safe',   -- fully clothed, platform-compliant
  'x_reddit_safe',           -- adult content permitted on X and Reddit
  'onlyfans_only',           -- explicit; never leaves OnlyFans
  'needs_review',            -- default on ingest
  'do_not_use'
);

create table public.assets (
  id             uuid primary key default gen_random_uuid(),
  karay_model_id uuid not null references public.karay_models(karay_model_id) on delete cascade,
  drive_file_id  text not null,
  drive_preview_url text,
  filename       text not null,
  mime_type      text not null,
  is_video       boolean not null default false,
  width          integer,
  height         integer,
  duration_secs  numeric,
  rating         public.asset_rating not null default 'needs_review',
  rated_by       uuid references public.users(id),
  rated_at       timestamptz,
  has_watermark  boolean not null default false,
  tags           text[] not null default '{}',
  created_at     timestamptz not null default now(),
  unique (karay_model_id, drive_file_id)
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
create table public.asset_usage (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
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
create table public.tracked_links (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,        -- short, URL-safe, e.g. 7 chars
  karay_model_id  uuid not null references public.karay_models(karay_model_id) on delete cascade,
  channel         text not null,
  packet_item_id  uuid,
  subreddit_id    uuid references public.subreddits(id) on delete set null,
  prospect_id     uuid references public.outreach_prospects(id) on delete set null,
  destination_url text not null,
  created_at      timestamptz not null default now()
);

create table public.link_clicks (
  id          bigserial primary key,
  link_id     uuid not null references public.tracked_links(id) on delete cascade,
  clicked_at  timestamptz not null default now(),
  ip_hash     text,                 -- salted hash, never the raw address
  user_agent  text,
  country     text,
  referrer    text
);

create index link_clicks_link_time_idx on public.link_clicks (link_id, clicked_at desc);
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
create table public.daily_packets (
  id           uuid primary key default gen_random_uuid(),
  karay_model_id uuid not null references public.karay_models(karay_model_id) on delete cascade,
  packet_date  date not null,
  status       text not null default 'preparing'
               check (status in ('preparing','ready','partial','failed')),
  prepared_at  timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (karay_model_id, packet_date)
);

create table public.packet_items (
  id            uuid primary key default gen_random_uuid(),
  packet_id     uuid not null references public.daily_packets(id) on delete cascade,
  channel       text not null,
  slot_index    integer not null default 1,      -- X post 1/2/3, subreddit 1..5
  asset_id      uuid references public.assets(id) on delete set null,
  title         text,                            -- Reddit
  body          text,                            -- caption / post text / DM draft
  hashtags      text[],
  subreddit_id  uuid references public.subreddits(id) on delete set null,
  prospect_id   uuid references public.outreach_prospects(id) on delete set null,
  tracked_link_id uuid references public.tracked_links(id) on delete set null,
  scheduled_for timestamptz,
  status        text not null default 'prepared'
                check (status in ('prepared','approved','scheduled','published_auto',
                                  'manual_required','completed_manual','failed','skipped')),
  published_url text,
  published_at  timestamptz,
  completed_by  uuid references public.users(id),
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

## 9. Reuse — read `docs/reference/` before designing a schema

KARAY has already solved much of this, and the owner has exported the relevant files into
this repository at `docs/reference/` (see 3.6). **Read them before writing a schema or a
generation prompt.** They are reference material: port the ideas and the conventions, do not
copy blindly, and never treat them as runnable code in this project.

| File | What it gives you |
|---|---|
| `contentStudio.ts` | A working Anthropic generation call: brand profile, niches, positioning, voice, target demographics and markets-to-avoid threaded into a platform-specific prompt, returning strict JSON. Its system prompt refuses sexual content and fabricated personal experience — that refusal is what keeps Instagram-bound output publishable. **Port this; do not write new prompts from scratch.** |
| `launchPacket.ts` | The multi-item generation shape the daily packet follows. |
| `daily-definition.ts` | The daily routine as 11 sections of permanent keys — war plan, OnlyFans page, chat shift, retention, per-platform, collabs, safety. RAYSSA's channels map onto these keys; reuse the keys so the two systems describe the same work with the same words. |
| `rls-policies.sql` | The predicate-helper pattern (`is_staff()`, `is_owner()`, per-table policies, explicit grants, `revoke all … from anon`). Follow it exactly — adapted to `public.is_active_user()` and `public.is_owner()`. |
| `daily-checklist.sql` | A well-formed migration: header comment explaining what and why, `security definer set search_path = public`, trigger-maintained projections, `drop policy if exists` before each `create policy`, per-role grants. Imitate its structure. |

For the record, KARAY also contains a 1,400-line brand-growth schema covering social
accounts, content items, publishing jobs, metrics and audit logs. **RAYSSA does not inherit
it** — separate databases mean separate schemas, and RAYSSA needs a much smaller surface than
that migration defines. It is mentioned so nobody goes looking for a shortcut that does not
exist across the boundary. Design RAYSSA's schema from this document.

If a file you need is missing from `docs/reference/`, ask for it. Do not request access to
the karaymodels repository — that boundary is deliberate (3.6).

## 10. Screens

1. `/login` — see the specification below.

### The login screen

RAYSSA is an internal command center, not a product with visitors. The login screen should
look like a control room: dark, typographic, nothing decorative. No logo file, no imagery, no
marketing copy — the wordmark *is* the design.

```
        ┌────────────────────────────────┐
        │                                │
        │      R A Y S S A               │   ← 64px, weight 700, tracking 0.28em
        │      COMMAND CENTER            │   ← 11px, tracking 0.35em, muted
        │      ──────────────────        │
        │                                │
        │      Email                     │
        │      [                     ]   │
        │                                │
        │      Senha / Password          │
        │      [                     ]   │
        │                                │
        │      [      ENTRAR       ]     │
        │                                │
        │      PT · EN                   │
        └────────────────────────────────┘
```

- **Layout:** full viewport, single centered column, `max-width: 380px`. Vertically centered
  on desktop; top-aligned with generous padding on mobile.
- **Palette:** background `#0B0B0C`, primary text `#FFFFFF`, muted text `#6B6B70`, input
  background `#141416` with a `#26262A` border, focus ring `#FFFFFF` at 40% opacity. One
  palette only — this screen does not follow the system light/dark preference.
- **Wordmark:** `RAYSSA`, uppercase, 64px desktop / 44px below 480px, weight 700,
  `letter-spacing: 0.28em`. Because tracking adds trailing space, offset with
  `margin-right: -0.28em` so it reads as optically centered.
- **Subtitle:** `COMMAND CENTER`, 11px, weight 500, `letter-spacing: 0.35em`, muted. Same in
  both locales — it is a name, not a translated string.
- **Fields:** email and password, 44px tall, 15px text, 2px radius. Labels above the field,
  12px, muted, translated. `autocomplete="email"` and `"current-password"`.
- **Button:** full width, 44px, white background, black text, uppercase, tracking 0.1em.
  Shows a spinner and disables while submitting.
- **Language toggle:** `PT · EN` beneath the button, 12px, muted, active locale in white.
  Switching re-renders in place and persists the choice.
- **Errors:** inline above the button, 13px, `#FF6B6B`, in the active locale. Always the same
  generic message — never reveal whether an email exists.
- **No signup link, no "forgot password", no marketing copy, no footer.** An owner creates
  users; there is nothing else to do on this page.
- After sign-in, a user with `must_change_password = true` lands on `/change-password` and
  cannot navigate away until it is cleared.

Every other screen inherits this palette and the same restraint: dense tables, generous
whitespace, no decoration. This is a tool for two people who will use it every morning.


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
2. A KARAY credential — any model's or representative's login — does not authenticate
   against RAYSSA at all. Separate auth instances; verify by attempting one.
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
10. No table grants anything to `anon`. Verify by querying
    `information_schema.role_table_grants`.
11. No code path anywhere in the repository stores an OnlyFans credential. Verify by
    grepping the schema and the codebase.
12. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
13. Supabase advisors report no new security or performance warnings.

---

## 12. Build order

Ship in this sequence. Each phase is independently useful, so the agency gets value before
the whole thing is finished.

0. **The integration API** — *owner-side, in the karaymodels repository, before Phase 1.*
   The three endpoints in 3.3, the token check, explicit column selection, rate limiting,
   request logging. Deliverable: a working API plus `API-CONTRACT.md` copied into both
   repositories.
1. **Foundation** — repo, Next.js, Tailwind, `next-intl` with both catalogues, Supabase
   client against RAYSSA's own project, `public.users` and its RLS, login, middleware,
   forced password change, seed script, both users created.
2. **Roster** — the integration client, the contract-shaped mock, `public.karay_models`, the
   15-minute sync with staleness reporting and failure alerting, and the dashboard listing
   active models. Build and test the whole phase against the mock first; only then point it
   at the real API. This phase proves the seam works, and it is the phase most likely to hide
   a defect that surfaces months later.
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
NEXT_PUBLIC_SUPABASE_URL=          # RAYSSA's OWN project — never KARAY's
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# KARAY integration API (see 3.3). Read-only except the checklist tick.
KARAY_API_BASE_URL=https://karaymodels.com/api/integrations/rayssa/v1
KARAY_API_TOKEN=                   # bearer token; the KARAY side holds the same value
KARAY_API_MOCK=false               # true serves contract fixtures with no network call

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
| Supabase (RAYSSA's own project) | $0 on free tier; $25 if it outgrows it |
| Google Drive | Existing |
| Anthropic API | ~$20 (Sonnet 5, batched + cached) |
| Instagram API | $0 |
| **Total** | **~$40/month** |
| X auto-publish, if enabled | +$7 per model per month |

The Cloudflare route removes the $20 hosting line at the cost of a migration and ongoing
runtime divergence from KARAY. The LLM line is irreducible without dropping generation
quality, and $20/month against the whole roster is not where cost optimization should start.
