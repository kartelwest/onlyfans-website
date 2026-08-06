#!/usr/bin/env bash
#
# RAYSSA bootstrap — does Steps 9 and 11 of docs/rayssa/SETUP-STEPS.md in one run.
#
#   1. Generates every random secret the project needs (a dev set and a prod set)
#   2. Clones the empty `rayssa` repository
#   3. Copies the specification, the contract and AGENTS.md into it
#   4. Exports the five reference files Devin needs but cannot otherwise read
#   5. Commits and pushes
#
# Run it from the ROOT of the karaymodels repository, AFTER creating the empty
# `rayssa` repo on GitHub (Step 4):
#
#   bash scripts/rayssa-bootstrap.sh git@github.com:kartelwest/rayssa.git
#
# The secrets are printed to your terminal and never written to a file. Copy them
# into your password manager before closing the window.

set -euo pipefail

REPO_URL="${1:-}"
if [[ -z "$REPO_URL" ]]; then
  echo "usage: bash scripts/rayssa-bootstrap.sh <rayssa-repo-git-url>" >&2
  echo "example: bash scripts/rayssa-bootstrap.sh git@github.com:kartelwest/rayssa.git" >&2
  exit 1
fi

# Must run from the karaymodels root — everything below is relative to it.
for required in docs/rayssa/BUILD-PROMPT.md lib/brand/ai/contentStudio.ts; do
  if [[ ! -f "$required" ]]; then
    echo "error: $required not found." >&2
    echo "Run this from the root of the karaymodels repository." >&2
    exit 1
  fi
done

command -v git >/dev/null || { echo "error: git not found." >&2; exit 1; }

gen() {
  if command -v openssl >/dev/null; then
    openssl rand -hex 32
  else
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

# ---------------------------------------------------------------- Step 9 -----
cat <<'BANNER'

================================================================================
  STEP 9 — SECRETS
  Copy these into your password manager NOW. They are not saved anywhere.
  Never reuse a production secret in the development environment.
================================================================================

BANNER

echo "--- PRODUCTION (Vercel project: rayssa) ---"
echo "RAYSSA_INTEGRATION_TOKEN     = $(gen)   # also add to the karaymodels project"
echo "SOCIAL_TOKEN_ENCRYPTION_KEY  = $(gen)"
echo "IP_HASH_SALT                 = $(gen)"
echo "CRON_SECRET                  = $(gen)"
echo
echo "--- DEVELOPMENT (Vercel project: rayssa-dev — Devin may see these) ---"
echo "SOCIAL_TOKEN_ENCRYPTION_KEY  = $(gen)"
echo "IP_HASH_SALT                 = $(gen)"
echo "CRON_SECRET                  = $(gen)"
echo
echo "The dev environment gets NO integration token — it runs KARAY_API_MOCK=true."
echo

read -r -p "Saved them? Press Enter to continue, Ctrl-C to abort. "

# --------------------------------------------------------------- Step 11 -----
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo
echo "Cloning $REPO_URL ..."
git clone --quiet "$REPO_URL" "$WORKDIR/rayssa"
TARGET="$WORKDIR/rayssa"

if [[ -f "$TARGET/AGENTS.md" || -d "$TARGET/docs/reference" ]]; then
  echo "error: this repository already has AGENTS.md or docs/reference/." >&2
  echo "It is not empty. Refusing to overwrite — copy the files by hand." >&2
  exit 1
fi

mkdir -p "$TARGET/docs/reference"

echo "Copying specification ..."
cp docs/rayssa/BUILD-PROMPT.md  "$TARGET/docs/BUILD-PROMPT.md"
cp docs/rayssa/API-CONTRACT.md  "$TARGET/docs/API-CONTRACT.md"
cp docs/rayssa/rayssa-AGENTS.md "$TARGET/AGENTS.md"

echo "Exporting reference files ..."
cp lib/brand/ai/contentStudio.ts "$TARGET/docs/reference/contentStudio.ts"
cp lib/brand/ai/launchPacket.ts  "$TARGET/docs/reference/launchPacket.ts"
cp lib/daily/definition.ts       "$TARGET/docs/reference/daily-definition.ts"
cp supabase/migrations/20260722000002_rls_policies.sql \
   "$TARGET/docs/reference/rls-policies.sql"
cp supabase/migrations/20260805030000_daily_marketing_checklist.sql \
   "$TARGET/docs/reference/daily-checklist.sql"

cat > "$TARGET/docs/reference/README.md" <<'REFERENCE'
# Reference material — read only

These files are copied from a **different** codebase (karaymodels) as reference. They are
**not part of this project**.

- **Do not import them.** They belong to another application with its own dependency tree.
- **Do not execute them.**
- **Do not edit them.** Edits here are meaningless — the originals live elsewhere.

Read them, understand the patterns, and **port** what you need into this project's own code.

| File | Why it is here |
|---|---|
| `contentStudio.ts` | A working Anthropic generation call — brand profile, niches, positioning, voice and targeting threaded into a platform-specific prompt returning strict JSON. Port this rather than writing new prompts. Note its system prompt refuses sexual content and fabricated personal experience; that refusal is what keeps Instagram-bound output publishable. |
| `launchPacket.ts` | The multi-item generation shape the daily packet follows. |
| `daily-definition.ts` | The agency's daily routine as 11 sections of permanent keys. Reuse the keys so both systems describe the same work with the same words. |
| `rls-policies.sql` | The row-level-security predicate-helper pattern to follow, adapted to this project's `is_active_user()` / `is_owner()`. |
| `daily-checklist.sql` | A well-formed migration to imitate: header comment explaining what and why, `security definer set search_path = public`, trigger-maintained projections, `drop policy if exists` before each `create policy`, explicit per-role grants. |

If something you need is missing, ask the owner. **Do not request access to the karaymodels
repository** — that boundary is deliberate. See rule zero in `AGENTS.md`.
REFERENCE

echo "Committing ..."
(
  cd "$TARGET"
  git add .
  git -c user.name="RAYSSA bootstrap" \
      -c user.email="noreply@karaymodels.com" \
      commit --quiet -m "docs: specification, integration contract, and reference material

Seeds the repository before the first implementation session:

- docs/BUILD-PROMPT.md  — the full specification
- docs/API-CONTRACT.md  — the KARAY integration seam (must stay identical
                          to the copy in the karaymodels repository)
- AGENTS.md             — standing rules, read every session
- docs/reference/       — five read-only files from the karaymodels
                          codebase: port the patterns, never import them"
  git push --quiet origin HEAD
)

cat <<'DONE'

================================================================================
  DONE — Steps 9 and 11 complete.
================================================================================

  Pushed to the rayssa repository:
    AGENTS.md
    docs/BUILD-PROMPT.md
    docs/API-CONTRACT.md
    docs/reference/  (5 files + README)

  Next:
    Step 10  — the KARAY integration API   (ask Claude Code to build it)
    Step 12  — create the two Vercel projects
    Step 13  — environment variables, using the secrets printed above
    Step 14  — DNS
    Step 15  — gather your data (this is the critical path)
    Step 16  — send docs/rayssa/DEVIN-PROMPT.md to Devin

DONE
