#!/usr/bin/env bash
#
# publish-public.sh
# -----------------
# Produce a scrubbed, code-only mirror of this repository and push it to a
# PUBLIC GitHub org repo. All markdown/text/office docs, DB dumps, and known
# internal doc directories are stripped from BOTH the tree AND the full history
# using `git filter-repo`, so no secret or private note ever reaches the public
# remote.
#
# The private repo (this one) remains the source of truth and stays connected
# to Vercel. Re-run this on each release to refresh the public mirror.
#
# Usage:
#   ./scripts/publish-public.sh                       # uses the Iso-nomia default below
#   PUBLIC_REMOTE=git@github.com:Iso-nomia/Isonomia.git ./scripts/publish-public.sh
#
# Public target: GitHub org "Iso-nomia" (account rohan@isonomia.app).
# Create the empty public repo under that org first, then run this script.
#
# Optional env vars:
#   BRANCH=main               Branch to mirror (default: current branch)
#   PUBLIC_BRANCH=main        Branch name to push on the public remote (default: main)
#   FORCE_PUSH=1              Force-push to overwrite public history (default: 1)
#   DRY_RUN=1                 Do everything except the final push
#   KEEP_WORKDIR=1           Do not delete the temp working clone (for inspection)
#
set -euo pipefail

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Default public remote: GitHub org "Iso-nomia" (account rohan@isonomia.app).
# Override by exporting PUBLIC_REMOTE, or change the repo name here if not "mesh".
PUBLIC_REMOTE="${PUBLIC_REMOTE:-git@github.com:Iso-nomia/Isonomia.git}"
BRANCH="${BRANCH:-$(git -C "$SOURCE_DIR" rev-parse --abbrev-ref HEAD)}"
PUBLIC_BRANCH="${PUBLIC_BRANCH:-main}"
FORCE_PUSH="${FORCE_PUSH:-1}"
DRY_RUN="${DRY_RUN:-0}"
KEEP_WORKDIR="${KEEP_WORKDIR:-0}"

# The public repo was created with an MIT license. Because this script force-
# pushes a rewritten history, we re-inject a LICENSE so it is never lost.
ADD_LICENSE="${ADD_LICENSE:-1}"
LICENSE_HOLDER="${LICENSE_HOLDER:-Isonomia}"
LICENSE_YEAR="${LICENSE_YEAR:-$(date +%Y)}"

# Collapse the whole mirror into a single fresh commit before pushing. This
# gives the public repo a clean "fresh start" and avoids exposing the private
# repo's internal commit messages. Set SQUASH_HISTORY=0 to keep full history.
SQUASH_HISTORY="${SQUASH_HISTORY:-1}"
SQUASH_MESSAGE="${SQUASH_MESSAGE:-Isonomia — public source snapshot}"

# --------------------------------------------------------------------------- #
# Exclude list  (removed from tree + full history)
#   --path-glob '*.ext'  : matches that extension at ANY directory depth
#   --path 'dir/'        : removes an entire directory subtree
# Edit this list to change what stays private.
# --------------------------------------------------------------------------- #
EXCLUDES=(
  # ---- documentation & office formats (all levels) ----
  --path-glob '*.md'
  --path-glob '*.txt'      # also catches keys.txt
  --path-glob '*.pdf'
  --path-glob '*.rtf'
  --path-glob '*.doc'
  --path-glob '*.docx'
  --path-glob '*.ppt'
  --path-glob '*.pptx'
  --path-glob '*.pages'

  # ---- secrets / dumps ----
  --path 'backup.dump'
  --path-glob '*.env'
  --path '.env'
  --path '.env.local'
  --path '.env.development'
  --path '.env.production'
  # (.env.example is intentionally kept as a safe template)

  # ---- committed build/deps junk (should never be in git; bloats pushes) ----
  --path '.venv/'
  --path-glob 'node_modules/*'
  --path-glob '*/node_modules/*'
  --path-glob '*.dylib'
  --path-glob '*.so'
  --path-glob '*.agdai'      # Agda build artifacts (regenerated on compile)

  # ---- large media assets (not code; cause GitHub push timeouts) ----
  --path 'public/sounds/'
  --path 'public/screenshots/'

  # ---- CI workflows: internal cron/deploy config; also requires 'workflow'
  #      token scope to push. Exclude from the public mirror (add public CI later).
  --path '.github/workflows/'

  # ---- internal / private doc-only directories (extensionless docs live here) ----
  --path 'Internal_Documents/'
  --path 'Development and Ideation Documents/'
  --path 'DigitalAgoraPlanning/'
  --path 'misc-docs-3/'
  --path 'misc-docs-4/'
  --path 'misc-documents/'
  --path 'misc-documents-2/'
  --path 'pivotDocs/'
  --path 'metastructuredocs/'
  --path 'Claude_Copilot_Documents/'
  --path 'Wilfrid Sellars/'
  --path 'Agora_Reference_Documents/'
  --path 'audits/'
  --path 'docs/'
  --path 'Development and Ideation Documents/'
  # NOTE: RESEARCH_PROGRAMME/ is intentionally NOT excluded wholesale because it
  # contains real Agda code. Its docs are stripped by the extension globs above.

  --invert-paths
)

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
log()  { printf '\033[1;34m[publish]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[publish]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[publish] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------------------- #
# Preflight
# --------------------------------------------------------------------------- #
[ -n "$PUBLIC_REMOTE" ] || die "PUBLIC_REMOTE is required (e.g. git@github.com:YOUR-ORG/mesh.git)"

if ! git filter-repo --version >/dev/null 2>&1; then
  die "git-filter-repo not found. Install it first:
       brew install git-filter-repo      # macOS
       pipx install git-filter-repo       # or: pip install git-filter-repo"
fi

log "Source repo : $SOURCE_DIR"
log "Source branch: $BRANCH"
log "Public remote: $PUBLIC_REMOTE  (branch: $PUBLIC_BRANCH)"

# --------------------------------------------------------------------------- #
# 1. Fresh throwaway clone of the chosen branch
# --------------------------------------------------------------------------- #
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/mesh-public.XXXXXX")"
cleanup() { [ "$KEEP_WORKDIR" = "1" ] || rm -rf "$WORKDIR"; }
trap cleanup EXIT

log "Cloning branch '$BRANCH' into $WORKDIR ..."
git clone --quiet --single-branch --branch "$BRANCH" "file://$SOURCE_DIR" "$WORKDIR"

cd "$WORKDIR"

# --------------------------------------------------------------------------- #
# 2. Strip docs/secrets from the entire history
# --------------------------------------------------------------------------- #
log "Rewriting history to remove docs, dumps, and internal directories ..."
git filter-repo --force "${EXCLUDES[@]}"

# --------------------------------------------------------------------------- #
# 3. Safety scan — abort if anything sensitive survived
# --------------------------------------------------------------------------- #
log "Verifying scrubbed tree ..."
LEAKS="$(git ls-files | grep -iE '\.(md|txt|pdf|rtf|docx?|pptx?|pages)$|^backup\.dump$|(^|/)keys\.txt$' || true)"
if [ -n "$LEAKS" ]; then
  warn "The following files unexpectedly survived filtering:"
  printf '  %s\n' $LEAKS >&2
  die "Refusing to push — investigate the exclude list."
fi

# scan full history object graph for the DB dump / key file names
if git log --all --pretty=format: --name-only --diff-filter=A 2>/dev/null \
     | grep -iqE '^backup\.dump$|(^|/)keys\.txt$'; then
  die "History still references backup.dump or keys.txt — aborting."
fi

FILE_COUNT="$(git ls-files | wc -l | tr -d ' ')"
log "Scrubbed tree contains $FILE_COUNT files. No doc/secret leaks detected."

# --------------------------------------------------------------------------- #
# 3b. Preserve the MIT LICENSE (force-push would otherwise wipe it)
# --------------------------------------------------------------------------- #
if [ "$ADD_LICENSE" = "1" ] && [ -z "$(git ls-files | grep -iE '^licen[sc]e')" ]; then
  log "Injecting MIT LICENSE ($LICENSE_YEAR $LICENSE_HOLDER) ..."
  cat > LICENSE <<EOF
MIT License

Copyright (c) $LICENSE_YEAR $LICENSE_HOLDER

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
  git add LICENSE
  git -c user.name="${GIT_AUTHOR_NAME:-publish-public}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-rohan@isonomia.app}" \
      commit --quiet -m "Add MIT LICENSE"
fi

# --------------------------------------------------------------------------- #
# 3c. Inject the public README (the private README.md is stripped by *.md)
#     Source template: scripts/public-README.md in the private repo.
# --------------------------------------------------------------------------- #
README_TEMPLATE="${README_TEMPLATE:-$SOURCE_DIR/scripts/public-README.md}"
if [ -f "$README_TEMPLATE" ]; then
  log "Injecting public README from $README_TEMPLATE ..."
  cp "$README_TEMPLATE" README.md
  git add README.md
  git -c user.name="${GIT_AUTHOR_NAME:-publish-public}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-rohan@isonomia.app}" \
      commit --quiet -m "Add public README"
else
  warn "No README template at $README_TEMPLATE — public repo will have no README."
fi

# --------------------------------------------------------------------------- #
# 3d. Inject CITATION.cff (enables GitHub's "Cite this repository" button)
#     Source template: scripts/public-CITATION.cff in the private repo.
# --------------------------------------------------------------------------- #
CITATION_TEMPLATE="${CITATION_TEMPLATE:-$SOURCE_DIR/scripts/public-CITATION.cff}"
if [ -f "$CITATION_TEMPLATE" ]; then
  log "Injecting CITATION.cff from $CITATION_TEMPLATE ..."
  cp "$CITATION_TEMPLATE" CITATION.cff
  git add CITATION.cff
  git -c user.name="${GIT_AUTHOR_NAME:-publish-public}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-rohan@isonomia.app}" \
      commit --quiet -m "Add CITATION.cff"
fi

# --------------------------------------------------------------------------- #
# 3e. Squash to a single fresh commit (clean public history; hides internal
#     commit messages). Disable with SQUASH_HISTORY=0.
# --------------------------------------------------------------------------- #
if [ "$SQUASH_HISTORY" = "1" ]; then
  log "Squashing history into a single fresh commit ..."
  git checkout --quiet --orphan __public_snapshot
  git add -A
  git -c user.name="${GIT_AUTHOR_NAME:-Isonomia}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-rohan@isonomia.app}" \
      commit --quiet -m "$SQUASH_MESSAGE"
fi

# --------------------------------------------------------------------------- #
# 4. Push to the public remote
# --------------------------------------------------------------------------- #
git remote remove origin 2>/dev/null || true
git remote add public "$PUBLIC_REMOTE"

FORCE_FLAG=()
[ "$FORCE_PUSH" = "1" ] && FORCE_FLAG=(--force)

if [ "$DRY_RUN" = "1" ]; then
  warn "DRY_RUN=1 set — skipping push. Command would have been:"
  warn "  git push ${FORCE_FLAG[*]} public HEAD:refs/heads/$PUBLIC_BRANCH"
  [ "$KEEP_WORKDIR" = "1" ] && log "Inspect the result at: $WORKDIR"
  exit 0
fi

# Large single pushes to GitHub over HTTP can time out (HTTP 408) when the pack
# is big. Push the history incrementally in commit-sized chunks so each request
# stays small; the final push moves the branch to HEAD. Set CHUNK=0 to disable
# and do one push.
CHUNK="${CHUNK:-300}"
REF="refs/heads/$PUBLIC_BRANCH"

if [ "$CHUNK" -gt 0 ]; then
  TOTAL=$(git rev-list --count HEAD)
  log "Incremental push: $TOTAL commits in chunks of $CHUNK ..."
  # every CHUNK-th commit (oldest-first), portable to bash 3.2 (no mapfile)
  for sha in $(git rev-list --reverse HEAD | awk -v c="$CHUNK" 'NR % c == 0'); do
    log "  pushing chunk up to ${sha:0:9} ..."
    git push "${FORCE_FLAG[@]}" public "$sha:$REF"
  done
  log "  pushing final HEAD ..."
  git push "${FORCE_FLAG[@]}" public "HEAD:$REF"
else
  log "Pushing scrubbed mirror to $PUBLIC_REMOTE ($PUBLIC_BRANCH) ..."
  git push "${FORCE_FLAG[@]}" public "HEAD:$REF"
fi

log "Done. Public mirror updated."

log "Done. Public mirror updated."
