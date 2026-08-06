# The Devin prompt

Send this **after** every step in `SETUP-STEPS.md` is done. Fill in the six bracketed answers
from Step 1 and delete the brackets. Everything else goes across as written.

This is the **Phase 1** kickoff only. Later phases have their own prompts in
`DEVIN-HANDOFF.md` — send them one at a time, after each previous phase merges.

---

## Copy from here

> I'm building an internal marketing operations platform called **RAYSSA** for my talent
> agency. The repository is `rayssa` and you have write access. Everything you need is
> already in it.
>
> **Read these three files in full before writing any code:**
>
> 1. `AGENTS.md` — standing rules. Rule zero especially: this repository is the whole world.
>    You have no access to our other codebase and no connection to its database, and you must
>    never ask for either.
> 2. `docs/BUILD-PROMPT.md` — the full specification. Section 2 ("What RAYSSA is not") is not
>    a list of nice-to-haves I'm deferring; those things are prohibited because they would get
>    my clients' social accounts banned. Section 5 (the media classification gate) is the most
>    safety-critical part of the build.
> 3. `docs/API-CONTRACT.md` — the one seam to the outside. Two GETs and one narrow POST, and
>    a mock you build against. You will never call the real endpoint.
>
> `docs/reference/` holds five files copied from our existing codebase as **read-only
> reference**: a working Anthropic content generator, our daily-routine definition, our RLS
> policy patterns, and a well-formed migration. Read them and port the patterns. Do not
> import, execute, or edit them — they are not part of this project.
>
> ---
>
> ### Build Phase 1 only
>
> Section 12 of the spec lists ten phases. **Implement Phase 1 and stop.** Do not work ahead;
> later phases depend on earlier ones being correct, and I review and merge each one before
> the next starts.
>
> Phase 1 is:
>
> - Next.js scaffold with TypeScript (strict), Tailwind v4, React 19
> - `next-intl` with both `pt-BR` and `en-US` catalogues, and an `i18n:check` script that
>   fails CI on any missing key or hardcoded string
> - Supabase client wired to the dev project (credentials are in the Vercel `rayssa-dev`
>   project's environment variables)
> - The `public.users` table from spec 3.4, with RLS from the first migration — not added
>   later
> - Email + password login, the middleware gate, and forced password change
> - A seed script creating five fake models with complete fake brand profiles. **Inventing
>   fake model data is correct here — this is the one place in the whole project where you
>   should invent anything.**
>
> ### The login screen
>
> Spec section 10 has the full specification — follow it exactly. The short version: this is a
> control room, not a product with visitors. Dark, typographic, nothing decorative, no logo
> file, no imagery, no marketing copy.
>
> **RAYSSA** in large letterspaced type is the entire design, with **COMMAND CENTER** beneath
> it, then email, password, sign-in button, and a PT · EN toggle. Nothing else on the page —
> no signup link, no forgot-password, no footer. Every other screen inherits the same palette
> and the same restraint.
>
> ### Two users, created by the seed script
>
> | Name | Email | Temporary password | Role |
> |---|---|---|---|
> | Kartel West | [YOUR EMAIL] | `West1234` | owner |
> | Raissa Vieira | [HER EMAIL] | `Eira1234` | owner |
>
> Both created with `must_change_password = true`. After signing in, each is redirected to
> `/change-password` and cannot navigate anywhere else until it's cleared. Create them through
> the Supabase admin API in the seed script — **never in a committed migration, and never with
> the password written into any file that gets committed.**
>
> There is no public signup. Owners invite users; that's the only path.
>
> ### My decisions
>
> - Domain: **[e.g. rayssa.karaymodels.com]**
> - Default interface language: **[pt-BR or en-US]**
> - Overnight job timezone: **[e.g. America/Sao_Paulo]**
> - Launch scope: **[e.g. pilot with 5 models]**
> - X paid publishing: **[OFF at launch]**
> - Active models the system must handle: **[e.g. up to 30]**
>
> ### Definition of done
>
> Acceptance criteria 1, 2, 3, 4 and 16 from spec section 11 must pass. For each one, paste
> the **actual command and its actual output** — not a summary, and not "verified". Criterion
> 1 in particular I want to see as a real `curl` against the deployed dev URL showing the
> redirect, not a description of the middleware.
>
> Before opening the pull request:
>
> ```
> npm run typecheck && npm run lint && npm test && npm run i18n:check
> ```
>
> All four must pass. Include the Supabase security-advisor output showing no new warnings.
>
> Open a pull request against `main`. Don't merge it — I review and merge.
>
> ### Before you start, tell me
>
> 1. Anything in the spec that's unclear, wrong, or that you'd approach differently. Push
>    back now rather than building around a problem — I'd rather rewrite a paragraph than a
>    phase.
> 2. Confirmation that you've read section 2 and section 5, and what you understand the media
>    classification gate to be enforcing.
> 3. Anything you need from me that isn't already in the repository.

## Copy to here

---

## After Phase 1 merges

Send the Phase 2 prompt from `DEVIN-HANDOFF.md`, then Phase 3, and so on. Phase 2 is the
integration seam and deserves a careful review — a defect there surfaces months later as
mysteriously stale data that nobody can trace.

Two things to check on **every** pull request, before you read the diff:

1. **The file list.** Changes should be inside this repository only, and never inside
   `docs/reference/`. If `docs/API-CONTRACT.md` was edited, stop — that file exists in two
   repositories and must stay identical; a contract change is a decision you make and apply
   to both copies yourself.
2. **Whether the claimed verification actually ran.** Devin reports success when it believes
   it succeeded, including after writing a test that asserts whatever it just implemented.
   Ask for the command and its output, every time.
