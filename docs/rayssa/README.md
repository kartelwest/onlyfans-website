# RAYSSA — what each file is

RAYSSA is **standalone**. Its own repository, its own Supabase project, its own database.
It connects to no other system, and no other system can affect it.

There is no single "prompt that builds RAYSSA." There is a specification that lives in the
repo, and short kickoff lines that point agents at it. Those are different things.

---

## The three files that matter

| File | What it is | Where it goes |
|---|---|---|
| **`BUILD-PROMPT.md`** | **The specification.** What RAYSSA is, what it must never do, the schema, the channel rules, the conventions, the acceptance criteria. | Becomes `PROJECT_BRIEF.md` in the new repo |
| **`rayssa-AGENTS.md`** | Standing rules + the relay handoff protocol. Every agent re-reads this each session. | Becomes `AGENTS.md` in the new repo |
| **`rayssa-init.sh`** | Creates the entire repo in one run: relay scaffold, hooks, secrets, first push. | You run it once |

## Supporting

| File | For |
|---|---|
| `SETUP-STEPS.md` | The manual accounts-and-keys setup — Supabase, Vercel, Google, Meta |
| `DEVIN-HANDOFF.md` | How to run an AI implementer safely; per-phase prompts |
| `DEVIN-PROMPT.md` | The Phase 1 kickoff message |
| `BEFORE-HANDOFF.md` | Background on the data you must gather |

---

## The order

```
1. Create an EMPTY private GitHub repo called `rayssa`
2. Put rayssa-init.sh + BUILD-PROMPT.md + AGENTS.md in one empty folder
3. bash rayssa-init.sh https://github.com/YOU/rayssa.git
4. Do SETUP-STEPS.md — Supabase, Vercel, Google, Meta, env vars
5. Start Step 15 (the data) and keep going — this is the real critical path
6. claude  ->  "Read AGENTS.md and PROJECT_BRIEF.md, then start Phase 1."
```

Steps 1–3 take ten minutes. Step 4 is about two hours. Step 5 is the one that decides
whether RAYSSA is useful or is a well-built generator of plausible nonsense.

---

## If you only remember three things

1. **An agent fabricates whatever you do not supply.** No subreddit list means forty
   invented subreddits with invented rules that pass every test and get models banned.
2. **Verify acceptance criterion 5 personally.** An asset rated `onlyfans_only` must be
   rejected by the *database* when attached to an Instagram slot — not merely hidden by the
   interface. Watch the SQL fail with your own eyes.
3. **Credentials never enter a chat window.** Password manager -> Vercel environment
   variables -> nowhere else.
