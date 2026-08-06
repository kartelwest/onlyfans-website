#!/usr/bin/env bash
# =============================================================================
#  RAYSSA — create the standalone project, ready for any AI agent to build.
#
#  Creates the full relay scaffold, drops the specification into
#  PROJECT_BRIEF.md, generates every secret, and pushes to a fresh repo.
#
#  BEFORE RUNNING — put these three files in one empty folder:
#      rayssa-init.sh        (this file)
#      BUILD-PROMPT.md       (the specification)
#      AGENTS.md             (the standing rules — renamed from rayssa-AGENTS.md)
#
#  THEN, from inside that folder:
#      bash rayssa-init.sh https://github.com/YOURNAME/rayssa.git
#
#  Create the GitHub repo first: private, and EMPTY (no README, no .gitignore).
#  Windows: run this in Git Bash, not PowerShell or CMD.
# =============================================================================
set -euo pipefail

REPO_URL="${1:-}"
[[ -z "$REPO_URL" ]] && {
  echo "usage: bash rayssa-init.sh <git-repo-url>" >&2
  echo "example: bash rayssa-init.sh https://github.com/kartelwest/rayssa.git" >&2
  exit 1
}

for f in BUILD-PROMPT.md AGENTS.md; do
  [[ -f "$f" ]] || { echo "error: $f must sit next to this script." >&2; exit 1; }
done
command -v git >/dev/null || { echo "error: git not found." >&2; exit 1; }
[[ -d .git ]] && { echo "error: already a git repo. Run in an empty folder." >&2; exit 1; }

gen() {
  if command -v openssl >/dev/null; then openssl rand -hex 32
  else node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; fi
}

# ----------------------------------------------------------------- secrets --
cat <<'B'

================================================================================
  SECRETS — copy into your password manager NOW. Never written to disk.
  Never paste any of these into a chat window.
================================================================================
B
echo
echo "--- PRODUCTION ---"
echo "SOCIAL_TOKEN_ENCRYPTION_KEY = $(gen)"
echo "IP_HASH_SALT                = $(gen)"
echo "CRON_SECRET                 = $(gen)"
echo
echo "--- DEVELOPMENT ---"
echo "SOCIAL_TOKEN_ENCRYPTION_KEY = $(gen)"
echo "IP_HASH_SALT                = $(gen)"
echo "CRON_SECRET                 = $(gen)"
echo
read -r -p "Saved? Press Enter to continue, Ctrl-C to abort. "

# --------------------------------------------------------------- structure --
mkdir -p .claude/hooks .claude/commands .windsurf/rules

mv BUILD-PROMPT.md PROJECT_BRIEF.md
echo "  PROJECT_BRIEF.md  <- the specification (no pasting required, ever)"

# ------------------------------------------------------------- CLAUDE.md ----
cat > CLAUDE.md <<'CLAUDEMD'
@AGENTS.md

## Claude Code specifics

- Hooks in `.claude/settings.json` auto-commit and push after every turn. You do not
  need to ask permission to commit; it is automatic.
- Run `/handoff` when the user says they are running low on usage.
- Use `/clear` between unrelated phases to keep context clean.
- `PROJECT_BRIEF.md` is the full specification. Read it before Phase 1 and re-read the
  relevant section before every later phase.
CLAUDEMD

# ------------------------------------------------------ windsurf / devin ----
cat > .windsurf/rules/relay.md <<'WSR'
---
trigger: always_on
---

Read `AGENTS.md` in the repo root before doing anything else and follow it exactly.
You are resuming a project already in progress — do not scaffold or re-initialise.
Continue from the "Next 3 steps" section of `HANDOFF.md`.

`PROJECT_BRIEF.md` is the specification. Section 2 lists prohibitions that exist
because violating them gets real social accounts banned. Read it before writing code.
WSR

# ------------------------------------------------------------ checkpoint ----
cat > .claude/hooks/checkpoint.sh <<'HOOK'
#!/usr/bin/env bash
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -z "$(git status --porcelain)" ] && exit 0

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

case "$BRANCH" in
  main|master|production)
    echo "checkpoint: refusing to auto-commit on '$BRANCH'." >&2
    exit 0
    ;;
esac

git add -A
git commit -q -m "checkpoint: $STAMP [auto]" || exit 0

if git push -q origin "HEAD:$BRANCH" 2>/dev/null; then
  echo "checkpoint: pushed to origin/$BRANCH" >&2
else
  echo "checkpoint: committed locally, push failed" >&2
fi
exit 0
HOOK
chmod +x .claude/hooks/checkpoint.sh

cat > .claude/settings.json <<'SETTINGS'
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/checkpoint.sh\"" } ] }
    ],
    "PreCompact": [
      { "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/checkpoint.sh\"" } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/checkpoint.sh\"" } ] }
    ]
  }
}
SETTINGS

cat > .claude/commands/handoff.md <<'CMD'
---
description: Write HANDOFF.md, commit, and push so another agent can take over
---

I am about to run out of usage. Do this now, completely, in one turn:

1. Stop at the nearest safe point. Start nothing new.
2. If any file is half-written or non-compiling, finish it or revert it. The pushed
   branch must build.
3. Overwrite `HANDOFF.md` using the exact structure in `AGENTS.md`. Real file paths,
   real function names, real commands. A fresh agent with zero context must be able to
   continue from it alone.
4. Write each "Next 3 steps" item as an instruction to another AI agent.
5. Run: git add -A && git commit -m "handoff: <one-line summary>" && git push
6. Reply with only: branch name, commit SHA, and the three next steps.
CMD

# ----------------------------------------------------------------- config ---
printf '*.sh text eol=lf\n' > .gitattributes

cat > .gitignore <<'IGN'
node_modules/
.next/
out/
build/
.env
.env.local
.env*.local
.vercel
.DS_Store
*.log
IGN

cat > .env.example <<'ENVEX'
# Supabase — RAYSSA's own project. Nothing here is shared with any other system.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic — content generation. Set a monthly spend cap in the console.
ANTHROPIC_API_KEY=

# Google Drive — media library, via a service account.
# Share the Drive folder with GOOGLE_SERVICE_ACCOUNT_EMAIL as Editor, or it sees nothing.
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ASSETS_ROOT_FOLDER_ID=

# Instagram publishing (Phase 9 — needs Meta Business Verification + App Review).
META_APP_ID=
META_APP_SECRET=

# 256-bit hex. Generate with: openssl rand -hex 32
SOCIAL_TOKEN_ENCRYPTION_KEY=
IP_HASH_SALT=
CRON_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
ENVEX

cat > README.md <<'RDM'
# RAYSSA

Internal marketing command center. Standalone — connects to no other system.

- **`PROJECT_BRIEF.md`** — the full specification. Start here.
- **`AGENTS.md`** — standing rules every AI agent reads each session.
- **`HANDOFF.md`** — created by the first agent; current state, overwritten constantly.

Private. Not for distribution.
RDM

# -------------------------------------------------------------------- git ---
git init -q
git branch -M main
git remote add origin "$REPO_URL"
git add -A
git -c user.name="RAYSSA init" -c user.email="noreply@rayssa.local" \
    commit -q -m "chore: relay scaffold and project brief"
git push -q -u origin main

git checkout -q -b wip/relay
git push -q -u origin wip/relay

cat <<'DONE'

================================================================================
  READY.
================================================================================

  PROJECT_BRIEF.md          the specification — never paste it anywhere
  AGENTS.md                 standing rules, read by every agent
  CLAUDE.md                 imports AGENTS.md
  .windsurf/rules/relay.md  same rules for Windsurf / Devin
  .claude/                  auto-checkpoint hook + /handoff command
  .env.example  .gitignore  .gitattributes

  On branch wip/relay. The hook refuses to auto-commit on main, by design.

  Next:
    1. claude
    2. /hooks           -> confirm Stop, PreCompact, SessionEnd are registered
    3. Paste this:

       Read AGENTS.md and PROJECT_BRIEF.md, then start Phase 1 from section 12.
       Confirm your plan before writing code.

  Switching to Windsurf/Devin later? git pull, then paste only:

       Follow AGENTS.md. You are picking up a handoff. Continue from HANDOFF.md.

DONE
