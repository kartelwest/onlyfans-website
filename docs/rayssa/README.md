# RAYSSA — what each file is

**There is no single "prompt that builds RAYSSA."** There is a specification that describes
what to build, and short kickoff messages that point an implementer at it, one phase at a
time. Those are different things and they are used at different moments.

Start here if you are lost.

---

## The map

| File | What it is | Who reads it | When |
|---|---|---|---|
| **`SETUP-STEPS.md`** | The 16 manual steps — accounts, keys, DNS, data | **You** | **First. Before anything else.** |
| `../../scripts/rayssa-bootstrap.sh` | Script that does Steps 9 and 11 for you | You run it | During setup, after Step 4 |
| **`BUILD-PROMPT.md`** | **The specification.** What RAYSSA is, what it must never do, the schema, the channel rules, the screens, the acceptance criteria | Devin, every session | Lives in the `rayssa` repo at `docs/BUILD-PROMPT.md` |
| **`rayssa-AGENTS.md`** | Standing rules — the short version Devin re-reads every session | Devin, every session | Copied to the `rayssa` repo root as `AGENTS.md` |
| **`API-CONTRACT.md`** | The one seam between RAYSSA and karaymodels | Both sides | Copied into **both** repos; must stay identical |
| **`DEVIN-PROMPT.md`** | The **Phase 1** kickoff message you paste | You → Devin | Step 16, once setup is done |
| **`DEVIN-HANDOFF.md`** | The other phase prompts, plus how to run Devin safely | **You** | Read before Phase 1; use its prompts for Phases 2–9 |
| **`BEFORE-HANDOFF.md`** | Background on why the setup is shaped this way, and the data you must gather | **You** | Optional reading; `SETUP-STEPS.md` covers the actions |

---

## The three that are easy to confuse

**`SETUP-STEPS.md`** is not about building anything. It is accounts, keys, environment
variables, DNS, and gathering the knowledge only your agency has. No code is written during
it. Roughly two hours of clicking, plus the data gathering.

**`BUILD-PROMPT.md`** is the specification — the substance. Nine hundred lines describing
what RAYSSA is, what it must never do and why, every table, the rules for each channel, the
login screen, the acceptance criteria. You do not paste this anywhere: it lives in the
`rayssa` repository and Devin reads it from there, in full, before every phase.

**`DEVIN-PROMPT.md`** is the short message you actually paste, and it only kicks off **Phase
1**. Its whole job is to point Devin at the specification, name the phase, and define what
"done" means. Phases 2 through 9 have their own prompts in `DEVIN-HANDOFF.md`, sent one at a
time as each previous phase merges.

---

## The order

```
1. Read SETUP-STEPS.md, do Steps 1–8            ← you, ~2 hours
2. Run scripts/rayssa-bootstrap.sh              ← Steps 9 and 11, one command
3. Ask Claude Code for the integration API      ← Step 10, code in this repo
4. Do Steps 12–14                               ← Vercel, env vars, DNS
5. Start Step 15 and keep going                 ← the data. The real critical path.
6. Paste DEVIN-PROMPT.md into Devin             ← Step 16. Phase 1 begins.
7. Review the PR, merge, send the Phase 2 prompt from DEVIN-HANDOFF.md
8. Repeat through Phase 9
```

Steps 1–4 and 6 are one long afternoon. Step 5 is the one that decides whether RAYSSA is
useful or is a well-built generator of plausible nonsense — start it early and do not let it
become the thing you rush at the end.

---

## If you only remember three things

1. **Devin fabricates whatever you do not supply.** No subreddit list means forty invented
   subreddits with invented rules that pass every test and get models banned. Step 15 is not
   optional.
2. **Verify acceptance criterion 5 personally.** An asset rated `onlyfans_only` must be
   rejected by the *database* when attached to an Instagram slot — not merely hidden by the
   interface. Watch the SQL fail with your own eyes.
3. **Credentials never enter a chat window.** Not ChatGPT's, not mine. Password manager →
   Vercel environment variable form → nowhere else.
