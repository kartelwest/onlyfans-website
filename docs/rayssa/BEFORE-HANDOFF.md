# RAYSSA — Before you hand this to a coder

**This document is for Kartel, not for the coder.** The coder gets `BUILD-PROMPT.md`.

A specification does not build software on its own. Roughly half the reason a project like
this stalls is that the developer starts, hits something only the owner can supply — an
account, a decision, a list of subreddits — and waits. Everything below exists so that when
the coder starts, they can finish.

Work through it in order. Sections A and B are blocking. Section D is the one people
underestimate and the one that determines whether the output is good or generic.

---

## A. Legal and access — do this first

- [ ] **Signed contractor agreement and NDA before any credential is shared.** This is not
      paperwork theatre. The models' legal names, birthdays, identity documents, earnings,
      payment details and proxy assignments live in the KARAY database. A developer who
      touches that infrastructure is handling other people's sensitive personal data, and
      you are the one responsible for it. Get it in writing first.
- [ ] **Confirm the agreement says the code is yours.** Work-for-hire / full assignment of
      copyright. Without that clause the developer owns what they wrote, which becomes a
      problem the first time you want to change developers.
- [ ] **Decide the access level, and write it down.** See section B — the recommendation is
      that the coder never receives production database credentials at all.

---

## B. Environments — the decision that protects you

`BUILD-PROMPT.md` specifies that RAYSSA runs against the same Supabase project as KARAY.
That is correct **in production**. It is not how the coder should develop.

Handing an outside developer the KARAY service-role key gives them unrestricted read access
to every model's personal data. You do not need to distrust anyone to refuse to do that; it
is simply not a level of access the job requires.

**Do this instead:**

- [ ] **Create a second, free Supabase project** named `rayssa-dev`. Free tier is fine — it
      holds nothing real.
- [ ] **Export the KARAY schema with no data** and give the coder the `.sql` file. From the
      Supabase dashboard, or `supabase db dump --schema public --data-only=false`. They need
      the *shape* of `models`, `profiles`, `brand_profiles` and the daily-checklist tables so
      their views and joins compile. They do not need one real row.
- [ ] **Have the coder write a seed script** that creates 5 fake models with fake brand
      profiles in `rayssa-dev`. First task of Phase 1. Their entire build runs against this.
- [ ] **You apply migrations to production yourself**, or run them under your own account
      after reviewing the coder's migration file. The coder's deliverable is a `.sql` file
      in a pull request, not a change already applied to your live database.
- [ ] **Two Vercel projects for RAYSSA**, both with Root Directory set to `rayssa/`:
      `rayssa-dev` pointed at the dev database, `rayssa` pointed at production. Production
      environment variables are set by you and visible only to you. Your existing
      `karaymodels` project keeps Root Directory `.` and is not touched.

If you later decide the coder is a long-term partner and this ceremony is slowing things
down, you can relax it deliberately. Start tight; loosening is easy, and un-leaking data is
not.

---

## C. Accounts to provision

Each line: who creates it, who holds the credential.

| # | Account | You create | Coder gets |
|---|---|---|---|
| 1 | Existing karaymodels repo — RAYSSA is a `rayssa/` sibling app (spec 3.6) | Already exists | Write, with branch protection on `main` |
| 2 | Vercel Pro team ($20/mo) | ✅ | Member on `rayssa-dev` only |
| 3 | Supabase project `rayssa-dev` (free) | ✅ | Full keys — it holds fake data |
| 4 | Supabase KARAY production | Already exists | **Nothing** |
| 5 | Anthropic API key — **new, separate from KARAY's** | ✅ | The dev key only |
| 6 | Google Cloud service account + Drive folder | ✅ | Service-account JSON for a *test* folder |
| 7 | Domain / DNS for `rayssa.karaymodels.com` | ✅ | Nothing — you point DNS at the end |
| 8 | Meta Developer account + Business Verification | ✅ | Developer role on the app |
| 9 | X developer account | Only if enabling paid X publishing | — |

Two notes on that table:

- **Item 5 — set a monthly spend limit on the new Anthropic key** in the console before
  handing it over. A generation loop with a bug can burn real money overnight. The expected
  spend is about $20/month; set the cap at $50 and you will find out about a bug from an
  email rather than from an invoice.
- **Item 8 — start Meta Business Verification today, before the coder starts.** It requires
  business documentation, a public website, and a privacy-policy URL, and it takes weeks
  that run in parallel with development instead of after it. It is the single longest lead
  time in this project. Instagram auto-publish is Phase 9 for exactly this reason: if
  verification is denied, you lose one feature and nothing else.

Also confirm, before Phase 9 is even scoped:

- [ ] Every model's Instagram account is a **Business or Creator** account (not Personal)
      and is **linked to a Facebook Page**. The publishing API does not work otherwise, and
      converting the accounts is a per-model manual step you can do now.

---

## D. Data you must gather — the coder cannot invent any of this

This is the section that decides whether RAYSSA produces useful output or generic filler.
Every item below is knowledge that lives in your team's heads, and none of it can be
written by a developer.

Budget real time for this. It is not a side task; on a project like this it is often the
critical path.

### D1. The subreddit list — the biggest one

The Reddit module is a database of institutional knowledge. Delivered empty, it is a blank
table and the feature is worthless. Delivered with 40 well-documented subreddits, it is the
most valuable screen in the product on day one.

- [ ] **Build a spreadsheet with exactly these columns** and fill it from what your reps
      already know:

  `subreddit_name` · `nsfw_allowed` · `verification_required` · `min_account_age_days` ·
  `min_karma` · `links_allowed` · `promo_days` · `title_rules` · `cooldown_hours` ·
  `niches` · `subscriber_count` · `notes`

- [ ] **A second sheet for per-model state:** `model` · `subreddit` · `is_verified` ·
      `last_posted_at` · `warning_count` · `banned` · `banned_reason`

Aim for 30–50 subreddits to start. Thirty accurate rows beat two hundred guessed ones —
wrong rules in this table cause the exact bans the table exists to prevent.

### D2. Brand profiles must be complete on KARAY

RAYSSA generates copy by reading each model's brand profile: niches, primary and secondary
positioning, brand voice / AI guidance, target gender, age range, countries, languages,
interests, and markets to avoid. `lib/brand/ai/contentStudio.ts` already threads all of it
into the prompt.

**A model with an empty brand profile gets generic output.** No prompt engineering fixes
missing input.

- [ ] Audit every active model's brand profile on KARAY. List which ones are incomplete.
- [ ] Fill them in before Phase 4. This is your work, not the coder's — it is judgement
      about positioning, not data entry.

### D3. Media organized in Drive

- [ ] One Drive folder per model, shared with the service account as Editor.
- [ ] **Rate a sample of at least 50 assets yourself** before Phase 3 is reviewed —
      Instagram/TikTok-safe, X/Reddit-safe, OnlyFans-only, do-not-use.

Do this early because it tells you how long rating takes per asset. Multiply by your whole
library and you will know whether the rating workload is an afternoon or a month. That
number, not the code, determines when RAYSSA actually goes live — which is also why the
launch-scope question in section E matters.

### D4. Examples of what actually works

The LLM needs a quality bar, and yours is better than its default.

- [ ] 5–10 X posts that genuinely performed (hooks, previews, CTAs)
- [ ] 5 Reddit titles that got real traction
- [ ] 5 Instagram captions in your house voice
- [ ] The outreach DM that actually gets replies
- [ ] 3 OnlyFans feed posts that converted

Provide them in both Portuguese and English if your models post in both. These go into the
generation prompts as few-shot examples and they are the difference between copy that
sounds like your agency and copy that sounds like a language model.

### D5. Miscellaneous

- [ ] **Where do tracked links point?** A landing page you own that then links to OnlyFans
      (recommended — two hops gives you a page view *and* a click-through), or straight to
      OnlyFans? If a landing page, does it exist yet?
- [ ] **OnlyFans handles** for every active model — usernames only. No passwords, ever.
- [ ] **Confirmed count of active models.** The system reads `active = true` and has no
      hardcoded cap; it is specified and load-tested for up to 30.

---

## E. Decisions to make

The coder will ask. Have answers ready.

| # | Decision | Recommendation |
|---|---|---|
| 1 | Domain | `rayssa.karaymodels.com` — simpler, shares nothing that matters |
| 2 | Hosting | Vercel Pro, $20/mo. Cloudflare saves $20 and costs weeks |
| 3 | X paid publishing | Off everywhere at launch. ~$207/mo across 30 models is not worth automating before you know which posts convert |
| 4 | Launch scope | **Pilot with 3–5 models.** See D3 — asset rating is the real bottleneck and you want to discover its size at 5 models, not 30 |
| 5 | Overnight job timezone | `America/Sao_Paulo` unless told otherwise |
| 6 | Who submits Meta app review | **You.** It is a business-identity process, not a coding task |
| 7 | Payment structure with the coder | Per phase, against the acceptance criteria — see section F |

---

## F. How to run the engagement

`BUILD-PROMPT.md` has nine phases and thirteen acceptance criteria. Use them.

- [ ] **Do not accept one large delivery at the end.** Pay per phase. Each is independently
      useful — you get a working login and roster from Phases 1–2 whether or not Phase 9
      ever ships.
- [ ] **Hard review gates at Phase 3, Phase 6, and Phase 9.** Phase 3 is the media
      classification gate and the most safety-critical code in the build. Phase 6 is
      attribution, which is where the product starts paying for itself.
- [ ] **Every pull request must include:** `npm run typecheck`, `npm run lint`,
      `npm test`, and `npm run i18n:check` all passing, plus the Supabase security-advisor
      output showing no new warnings.
- [ ] **Test acceptance criterion #5 yourself.** Ask the coder to demonstrate it live: an
      asset rated `onlyfans_only` must be rejected by the *database* when someone tries to
      attach it to an Instagram slot — not merely hidden by the interface. Have them run the
      SQL insert directly and show you the error. If it succeeds, the build is not done, no
      matter what the screen looks like. This is the one test that protects the accounts
      that make your money.
- [ ] **Ask for a 15-minute walkthrough at the end of each phase.** Not a written report —
      a screen share. You will learn more, and it keeps a stalled phase from hiding behind
      a status update.

### Red flags — stop the work and talk to me if the coder proposes any of these

You are hiring someone to build in a domain where the fastest-looking path is the one that
gets your models banned. These are the specific proposals that should stop the project:

1. **"I can automate X/Reddit/TikTok posting with Playwright/Puppeteer/a browser bot."** No.
   Every one of those platforms prohibits it and the penalty lands on the model's account.
2. **"There's an OnlyFans API we can use."** There is no official one. Every vendor
   claiming otherwise is reverse-engineering the private API or driving a browser
   extension. It violates the terms either way, and one vendor's mistake becomes every
   managed account's ban.
3. **"Let's store the OnlyFans logins so the system can post directly."** Never. No
   password, no session cookie, no 2FA seed.
4. **"I need the production database credentials to develop."** They do not. See section B.
5. **"We can skip the asset rating step and classify with AI."** A false negative here ends
   an Instagram account. A human rates every asset.
6. **"I'll put the RAYSSA tables in the `public` schema, it's simpler."** It is simpler
   right up until a RAYSSA migration collides with a KARAY one on your live database.
7. **"Row-level security is slowing me down, I'll add it at the end."** Security added at
   the end is security that does not exist. KARAY's existing migrations show the pattern to
   follow.

A good developer will push back on parts of the spec — that is a sign they are reading it,
not a red flag. The list above is different: those seven are not technical disagreements,
they are proposals to trade your models' accounts for a shorter timeline.

---

## G. What to send the coder

Once sections A–C are done, send exactly this:

1. `docs/rayssa/BUILD-PROMPT.md`
2. Nothing extra for repository access — RAYSSA lives in the karaymodels repo as a `rayssa/`
   sibling app, so the existing migrations, `lib/brand/ai/contentStudio.ts`,
   `lib/daily/definition.ts`, and the i18n setup are already readable. Section 9 of the spec
   depends on that, and reading that code is what turns a three-month build into a
   one-month build. Make the build-isolation commit from spec 3.6 first.
3. The schema-only `.sql` export from section B
4. Credentials from the section C table — dev only
5. The spreadsheets and examples from section D
6. Your answers to section E

**Do not send** production Supabase keys, the KARAY Anthropic key, or DNS access.

### Copy-paste kickoff message

> Hi — I'd like you to build an internal marketing platform called RAYSSA for my talent
> agency. It's a separate application from our existing site, though it reads model data
> from the same database.
>
> The full specification is attached as `BUILD-PROMPT.md`. **Please read all of it before
> writing any code**, including section 2, "What RAYSSA is not" — several features that look
> obvious are prohibited because they would get our clients' social accounts banned, and the
> reasoning is in the document.
>
> Two things to note before you start:
>
> **Section 9 matters more than it looks.** Our existing repository already contains most of
> the schema and the content-generation code this needs — roughly 1,400 lines of migration
> plus a working Anthropic integration. I've given you read access. Please read that code and
> reuse it rather than building parallel versions. If you conclude something genuinely needs
> to be new, tell me why and I'm happy to hear it.
>
> **You'll develop against a separate database.** I've set up a dev Supabase project and
> attached a schema-only export of production. Your first task in Phase 1 is a seed script
> creating about five fake models. You won't have production credentials; migrations come to
> me as `.sql` files in a pull request and I apply them.
>
> The spec has nine phases and thirteen acceptance criteria. I'd like to work phase by phase,
> with a short screen-share walkthrough at the end of each. Payment tracks the phases.
>
> Before you start, please confirm:
> 1. Your estimate per phase, and where you think the spec is wrong or unclear
> 2. That you've read section 2 and section 5 (the media classification gate)
> 3. Anything you need from me that isn't in the package
>
> Answers to the open questions in section 14: [paste your section E decisions]

---

## H. One-page summary

**Blocking before the coder starts:**
NDA signed · dev Supabase project created · schema exported · GitHub repo created with
coder added · Vercel Pro · separate Anthropic key with a spend cap · section E decisions
made

**Start now because it takes weeks:**
Meta Business Verification · converting Instagram accounts to Business/Creator

**Blocking before Phase 4 (generation):**
Brand profiles complete for every active model · the "what actually works" examples

**Blocking before Phase 7 (Reddit):**
The subreddit spreadsheet

**The thing that will actually delay launch:**
Asset rating. Rate 50 assets yourself this week and time it. That number tells you your
real launch date, and it is why the recommendation is to pilot with 3–5 models.
