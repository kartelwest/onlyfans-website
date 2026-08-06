# RAYSSA — Setup steps, in order

Everything you do by hand before Devin starts. Work top to bottom; the order is dependency
order, not importance order.

**Keep a scratch file open.** Many steps produce a value a later step consumes. Every one of
those is marked 📋 **SAVE**. Use a password manager, not a text file on your desktop.

Rough timings: Steps 1–11 are about three focused hours. Step 2 takes weeks of *waiting* but
ten minutes of *doing*, which is why it is near the top. Step 15 is the one that can take
days and is the one people underestimate.

---

## Step 1 — Lock your decisions (10 minutes)

Write these down. Devin will ask, and changing your mind mid-build costs real work.

a. **Domain:** `rayssa.karaymodels.com` (recommended) or something else.
b. **Hosting:** Vercel Pro, $20/month (recommended).
c. **X paid publishing:** OFF at launch (recommended — ~$207/month across 30 models).
d. **Launch scope:** pilot with 3–5 models (strongly recommended) or all active models.
e. **Overnight job timezone:** `America/Sao_Paulo` unless you say otherwise.
f. **Interface language default:** `pt-BR` or `en-US`. Both are built either way; this is
   only which one a new user sees first.

📋 **SAVE** — you paste these into the Devin prompt at the very end.

---

## Step 2 — Start Meta Business Verification (10 minutes doing, weeks waiting)

Do this **first**, today, even though Instagram publishing is the last phase built. It is the
longest lead time in the project and it runs in the background while everything else happens.

a. Go to **business.facebook.com** and sign in with the Facebook account that administers
   your models' pages.
b. If you have no Business Portfolio yet, create one: **Settings → Business info → Create**.
   Use the real agency name and address.
c. Go to **Settings → Business info → Security Center** (some accounts show this as
   **Business verification**). Click **Start verification**.
d. You will need: a business registration document, a utility bill or bank statement showing
   the business address, and a **public website with a privacy policy page**. If
   karaymodels.com has no privacy policy, add one before starting — it is a common rejection
   reason.
e. Submit and move on. It typically takes days to weeks.

📋 **SAVE** — the Business Portfolio ID.

**Then, separately, create the developer app:**

f. Go to **developers.facebook.com → My Apps → Create App**.
g. Use case: choose the option for **Other**, then app type **Business**.
h. Name it `RAYSSA`. Link it to the Business Portfolio from step (b).
i. In the app dashboard, add the **Instagram** product.
j. From **App settings → Basic**, copy the **App ID** and **App Secret**.

📋 **SAVE** — `META_APP_ID`, `META_APP_SECRET`.

> **Do not submit for App Review yet.** That comes at Phase 9, when there is a working app to
> demonstrate. Verification (d) and App Review are two different processes; only verification
> starts now.

**While you are here** — a per-model task you can start immediately:

k. Every model's Instagram must be a **Business** or **Creator** account, not Personal, and
   must be **linked to a Facebook Page**. On the phone: Instagram → Settings → Account type
   and tools → Switch to professional account. The publishing API does not work on Personal
   accounts.

---

## Step 3 — Vercel Pro (10 minutes)

a. Go to **vercel.com** and sign in with the GitHub account that owns karaymodels.
b. Top-left team switcher → **Create Team**. Name it `karay` (or reuse an existing team).
c. Choose the **Pro** plan, $20/month per seat. One seat is enough.
d. If karaymodels.com is currently deployed under a personal Hobby account, move it into this
   team: open the project → **Settings → General → Transfer Project**.

> Hobby is non-commercial per Vercel's terms, and this is a commercial agency tool. The $20
> buys you the right to run it and the right not to think about it again.

---

## Step 4 — Create the GitHub repository (5 minutes)

a. Go to **github.com/new**.
b. Owner: the same account that owns `onlyfans-website`. Repository name: **`rayssa`**.
c. Visibility: **Private**. Non-negotiable.
d. Tick **Add a README file** so the repo has a default branch. Create.
e. Open **Settings → Rules → Rulesets → New branch ruleset** (older accounts: **Settings →
   Branches → Add rule**).
   - Name: `protect main`. Target branch: `main` (or default branch).
   - Enable **Require a pull request before merging**.
   - Enable **Require approvals**, set to **1**.
   - Enable **Block force pushes**.
   - Save.
f. **Settings → Collaborators → Add people** → add the Devin integration or the GitHub
   account Devin uses. Role: **Write**, not Admin.

📋 **SAVE** — the repo URL.

> (e) is what stops Devin merging its own work. It takes ninety seconds and it is the single
> highest-leverage control in this entire document.

---

## Step 5 — Create RAYSSA's production database (10 minutes)

a. Go to **supabase.com/dashboard** and sign in.
b. **New project**.
   - Organization: your existing one.
   - Name: **`rayssa-prod`**.
   - Database password: generate a strong one. 📋 **SAVE** — you will rarely need it, and it
     is painful to reset later.
   - Region: choose the one closest to your team. If your reps are in Brazil, pick
     **South America (São Paulo)**.
   - Plan: **Free** is correct to start.
c. Wait for provisioning (~2 minutes).
d. Go to **Project Settings → API** (gear icon, bottom-left). Copy three values:
   - **Project URL** → 📋 `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → 📋 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → 📋 `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ The **service_role** key bypasses every row-level security policy. It goes in Vercel's
> production environment variables and **nowhere else, ever**. Not in a chat message, not in
> a repo, not to Devin.

e. Go to **Database → Extensions**. Search for and enable **`pg_cron`** and **`pg_net`**.
   These run the overnight preparation job.
f. Go to **Authentication → Sign In / Providers**. Confirm **Email** is enabled. Turn
   **Confirm email** OFF (you create both users by hand) and turn on **leaked password
   protection** if the option is offered.

---

## Step 6 — Create the development database (5 minutes)

a. **New project** again. Name: **`rayssa-dev`**. Free plan. Same region.
b. **Project Settings → API** → copy the same three values as Step 5d.

📋 **SAVE** — as `DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`, `DEV_SUPABASE_SERVICE_ROLE_KEY`.

c. Enable `pg_cron` and `pg_net` here too (**Database → Extensions**).

**These are the only database credentials Devin ever receives.** This project holds five fake
models. If Devin drops every table in it, you lose nothing.

---

## Step 7 — Anthropic API key with a spend cap (5 minutes)

a. Go to **console.anthropic.com** and sign in.
b. **Settings → API keys → Create key**. Name it `rayssa-dev`.
c. Copy it immediately — it is shown once. 📋 **SAVE** as `DEV_ANTHROPIC_API_KEY`.
d. Create a second key named `rayssa-prod`. 📋 **SAVE** separately. Devin never gets this one.
e. Go to **Settings → Limits** (or **Usage limits**) and set a **monthly spend limit of $50**.

> Expected spend is about $20/month. The cap means a runaway generation loop reaches you as
> an email rather than as an invoice. Do not skip it.

---

## Step 8 — Google Cloud service account and Drive folder (20 minutes)

This is the fiddliest step. Read (g) carefully — it is the one everybody misses.

a. Go to **console.cloud.google.com**. Create a new project named `rayssa` (top-left project
   dropdown → **New Project**).
b. **APIs & Services → Library**. Search **Google Drive API** → **Enable**.
c. **APIs & Services → Credentials → Create Credentials → Service account**.
   - Name: `rayssa-drive`. Create and continue. Skip the optional role and access steps.
d. Click the service account you just made → **Keys** tab → **Add key → Create new key →
   JSON**. A `.json` file downloads.
e. Open that file. You need two values from it:
   - `client_email` → 📋 `GOOGLE_SERVICE_ACCOUNT_EMAIL` (looks like
     `rayssa-drive@rayssa-xxxxx.iam.gserviceaccount.com`)
   - `private_key` → 📋 `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (a long block beginning
     `-----BEGIN PRIVATE KEY-----`)
f. In **Google Drive**, create a folder named `RAYSSA ASSETS`. Inside it, one subfolder per
   model, named exactly as the model's stage name.
g. **Right-click `RAYSSA ASSETS` → Share → paste the `client_email` from (e) → set to
   Editor → Share.** A service account sees nothing that has not been explicitly shared with
   it. Skipping this produces an empty asset library and a confusing "permission denied" that
   looks like a code bug.
h. Open the `RAYSSA ASSETS` folder and copy the folder ID from the browser address bar — the
   long string after `/folders/`. 📋 **SAVE** as `GOOGLE_DRIVE_ASSETS_ROOT_FOLDER_ID`.
i. Create a second folder `RAYSSA ASSETS TEST` with two or three harmless photos, shared the
   same way. This is the one Devin gets. 📋 **SAVE** its folder ID separately.

---

## Step 9 — Generate the secrets (2 minutes)

Run these four commands. Each prints one random value.

```sh
openssl rand -hex 32   # RAYSSA_INTEGRATION_TOKEN   — the KARAY↔RAYSSA API token
openssl rand -hex 32   # SOCIAL_TOKEN_ENCRYPTION_KEY — encrypts stored OAuth tokens
openssl rand -hex 32   # IP_HASH_SALT                — salts click-tracking IP hashes
openssl rand -hex 32   # CRON_SECRET                 — guards /api/cron/*
```

📋 **SAVE** all four. Generate a **separate** set for dev; never reuse a production secret in
a development environment.

> No `openssl`? Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## Step 10 — Build the KARAY integration API (Phase 0 — code)

RAYSSA reads model data over HTTP because the two databases are now separate. Three endpoints
have to exist inside karaymodels before RAYSSA's Phase 2 has anything to point at:

- `GET  /api/integrations/rayssa/v1/models`
- `GET  /api/integrations/rayssa/v1/models/:id/brand-profile`
- `POST /api/integrations/rayssa/v1/models/:id/checklist`

Specified in full in `docs/rayssa/API-CONTRACT.md`.

a. **Devin does not build this.** It is code inside your production site, and keeping Devin
   out of this repository is the whole point of the separate-repo decision.
b. Ask me (Claude Code, in the karaymodels repo) to build it. It is a small, contained pull
   request: three route handlers, a constant-time token check, explicit column selection, a
   rate limiter, and tests.
c. Add `RAYSSA_INTEGRATION_TOKEN` from Step 9 to the **karaymodels** Vercel project's
   environment variables (Step 13 shows where).
d. Verify it before moving on:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://karaymodels.com/api/integrations/rayssa/v1/models
# expect 401

curl -H "Authorization: Bearer <RAYSSA_INTEGRATION_TOKEN>" \
     https://karaymodels.com/api/integrations/rayssa/v1/models
# expect JSON with a "models" array
```

📋 **SAVE** — `KARAY_API_BASE_URL=https://karaymodels.com/api/integrations/rayssa/v1`

---

## Step 11 — Seed the `rayssa` repository (15 minutes)

Devin reads files in the repo far more reliably than long pasted prompts. Put everything
there before session one.

a. Clone the empty repo:
   ```sh
   git clone https://github.com/<you>/rayssa.git && cd rayssa
   mkdir -p docs/reference
   ```
b. Copy the four documents in from karaymodels:
   ```
   docs/rayssa/BUILD-PROMPT.md    →  rayssa/docs/BUILD-PROMPT.md
   docs/rayssa/API-CONTRACT.md    →  rayssa/docs/API-CONTRACT.md
   docs/rayssa/rayssa-AGENTS.md   →  rayssa/AGENTS.md          ← note the rename
   ```
c. **Export the reference files.** This is the ten-minute task that saves weeks — with two
   repositories Devin cannot read your existing code, and without these it reinvents your
   generation prompts and your RLS conventions from scratch:
   ```
   lib/brand/ai/contentStudio.ts                        → docs/reference/contentStudio.ts
   lib/brand/ai/launchPacket.ts                         → docs/reference/launchPacket.ts
   lib/daily/definition.ts                              → docs/reference/daily-definition.ts
   supabase/migrations/20260722000002_rls_policies.sql  → docs/reference/rls-policies.sql
   supabase/migrations/20260805030000_daily_marketing_checklist.sql
                                                        → docs/reference/daily-checklist.sql
   ```
d. Create `docs/reference/README.md` containing exactly:
   > These files are copied from the karaymodels codebase as **reference only**. They are not
   > part of this project and must not be imported, executed, or edited. Read them, understand
   > the patterns, and port what you need into `rayssa/`.
e. Commit and push:
   ```sh
   git add . && git commit -m "docs: specification, contract, and reference material" && git push
   ```

---

## Step 12 — Create the Vercel projects (10 minutes)

a. **vercel.com/new** → **Import Git Repository** → select `rayssa`.
b. Name it **`rayssa-dev`**. Do not deploy yet — add environment variables first (Step 13).
   Framework preset: Next.js. Root Directory: leave as `./`.
c. Repeat: import `rayssa` a second time, name it **`rayssa`** (production).
d. On the **production** project only: **Settings → Git → Production Branch** = `main`.
e. On the **dev** project: **Settings → Git → Production Branch** = `develop`, so Devin's
   work deploys somewhere visible without ever touching production.

---

## Step 13 — Environment variables (15 minutes)

In each Vercel project: **Settings → Environment Variables**. Add each as a separate entry;
select all three environments (Production, Preview, Development) unless noted.

**`rayssa-dev` project — Devin may see all of these:**

```
NEXT_PUBLIC_SUPABASE_URL          = <rayssa-dev project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <rayssa-dev anon key>
SUPABASE_SERVICE_ROLE_KEY         = <rayssa-dev service_role key>
ANTHROPIC_API_KEY                 = <DEV_ANTHROPIC_API_KEY>
KARAY_API_BASE_URL                = https://karaymodels.com/api/integrations/rayssa/v1
KARAY_API_MOCK                    = true
GOOGLE_SERVICE_ACCOUNT_EMAIL      = <service account email>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY= <private key block>
GOOGLE_DRIVE_ASSETS_ROOT_FOLDER_ID= <TEST folder id>
SOCIAL_TOKEN_ENCRYPTION_KEY       = <dev secret>
IP_HASH_SALT                      = <dev secret>
CRON_SECRET                       = <dev secret>
NEXT_PUBLIC_APP_URL               = https://rayssa-dev.vercel.app
```

Note `KARAY_API_MOCK = true` and **no** `KARAY_API_TOKEN`. Devin builds against the mock and
never touches live model data.

**`rayssa` project (production) — you set these, Devin never sees them:**

```
NEXT_PUBLIC_SUPABASE_URL          = <rayssa-prod project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <rayssa-prod anon key>
SUPABASE_SERVICE_ROLE_KEY         = <rayssa-prod service_role key>
ANTHROPIC_API_KEY                 = <PROD Anthropic key>
KARAY_API_BASE_URL                = https://karaymodels.com/api/integrations/rayssa/v1
KARAY_API_TOKEN                   = <RAYSSA_INTEGRATION_TOKEN from Step 9>
KARAY_API_MOCK                    = false
GOOGLE_SERVICE_ACCOUNT_EMAIL      = <service account email>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY= <private key block>
GOOGLE_DRIVE_ASSETS_ROOT_FOLDER_ID= <REAL assets folder id>
META_APP_ID                       = <from Step 2j>
META_APP_SECRET                   = <from Step 2j>
SOCIAL_TOKEN_ENCRYPTION_KEY       = <prod secret>
IP_HASH_SALT                      = <prod secret>
CRON_SECRET                       = <prod secret>
NEXT_PUBLIC_APP_URL               = https://rayssa.karaymodels.com
```

**`karaymodels` project — add one variable:**

```
RAYSSA_INTEGRATION_TOKEN          = <same value as KARAY_API_TOKEN above>
```

> The private key block contains newlines. Paste it into Vercel's multi-line value box
> exactly as it appears in the JSON, including the `BEGIN`/`END` lines. Mangled newlines here
> are the most common Drive authentication failure.

---

## Step 14 — Point the domain (10 minutes, plus DNS propagation)

a. In the **`rayssa`** (production) Vercel project: **Settings → Domains → Add**.
b. Enter `rayssa.karaymodels.com`.
c. Vercel shows a CNAME record. Go to wherever karaymodels.com's DNS is managed (Cloudflare,
   your registrar, or Vercel itself) and add it:
   - Type: `CNAME` · Name: `rayssa` · Value: the target Vercel gives you
   - On Cloudflare, set the proxy status to **DNS only** (grey cloud), not proxied.
d. Wait for Vercel to show **Valid Configuration**. Usually minutes.

---

## Step 15 — Gather the data only you have (days — start now)

**This determines whether RAYSSA is useful or is a beautifully-built generator of nonsense.**
Devin cannot invent any of it, and — this is the important part — *it will not ask you for
it*. It will fabricate confident, plausible, wrong substitutes that pass every test.

### 15a. The subreddit spreadsheet — needed by Phase 7

Create a Google Sheet named `RAYSSA — Subreddits`, sheet 1 with exactly these columns:

`subreddit_name` · `nsfw_allowed` · `verification_required` · `min_account_age_days` ·
`min_karma` · `links_allowed` · `promo_days` · `title_rules` · `cooldown_hours` · `niches` ·
`subscriber_count` · `notes`

Sheet 2, per-model state:

`model` · `subreddit` · `is_verified` · `last_posted_at` · `warning_count` · `banned` ·
`banned_reason`

Fill it from what your reps already know. **Aim for 30–50 rows.** Thirty accurate rows beat
two hundred guessed ones — wrong rules here cause exactly the bans the table exists to
prevent. Export as CSV when done.

### 15b. Brand profiles — needed by Phase 4

Open KARAY's admin, go through every active model, and confirm the brand profile has: niches,
primary positioning, brand voice / AI guidance, target gender, age range, countries,
languages, interests, markets to avoid.

A model with an empty profile gets generic copy. No prompt engineering fixes missing input.
This is judgement about positioning, so it is your work, not anyone's tooling.

### 15c. Media in Drive — needed by Phase 3

One folder per model inside `RAYSSA ASSETS` (Step 8f). Then: **rate fifty assets yourself and
time how long it takes.** Multiply by your library.

That number is your real launch date. It is why the recommendation is to pilot with 3–5
models — you want to discover the rating workload at five models, not at thirty.

### 15d. Examples of what actually works — needed by Phase 4

In a document: 5–10 X posts that genuinely performed, 5 Reddit titles that got traction, 5
Instagram captions in your house voice, the outreach DM that gets replies, 3 OnlyFans feed
posts that converted. Portuguese and English if your models post in both.

These become the quality bar in the generation prompts. Without them you get competent,
generic, forgettable copy.

### 15e. Loose ends

- Where do tracked links point? A landing page you own that then links to OnlyFans
  (recommended — two hops gives a page view *and* a click-through), or straight to OnlyFans?
  If a landing page, does it exist?
- OnlyFans handles for every active model. **Usernames only. No passwords, ever.**
- Confirmed count of active models.

---

## Step 16 — Send Devin the Phase 1 prompt

Everything above is done. Open `docs/rayssa/DEVIN-PROMPT.md`, fill in the bracketed answers
from Step 1, and paste it into a new Devin session.

Then, after each phase merges, send the next phase prompt from `DEVIN-HANDOFF.md`.

---

## Final check before you start

- [ ] Branch protection on `rayssa`/`main`, approvals required (Step 4e)
- [ ] Devin has `rayssa-dev` credentials only — never `rayssa-prod`, never karaymodels
- [ ] `$50` spend cap on the Anthropic key (Step 7e)
- [ ] Drive folder actually shared with the service-account email (Step 8g)
- [ ] Integration API returns 401 without a token (Step 10d)
- [ ] `KARAY_API_MOCK = true` in the dev project, and no `KARAY_API_TOKEN` there
- [ ] `docs/reference/` has all five files plus its README (Step 11c–d)
