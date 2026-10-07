#!/bin/bash
# Hermetic tests for statusline/statusline.sh: throwaway repos under mktemp, run
# under /bin/bash (3.2 on macOS) as the status line itself runs.
#
#   bash tests/test-statusline.sh

set -u
export LC_ALL=en_US.UTF-8 # sed must read the ⎇ and … glyphs as characters
SCRIPT=$(cd "$(dirname "$0")/.." && pwd)/statusline/statusline.sh
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/hintline-tests.XXXXXX") || exit 2
trap 'rm -rf "$SANDBOX"' EXIT
export GIT_CONFIG_GLOBAL=$SANDBOX/gitconfig GIT_CONFIG_NOSYSTEM=1
git config --global init.defaultBranch main
git config --global user.name hintline-tests
git config --global user.email hintline-tests@example.invalid

repo=$SANDBOX/myrepo
git init -q "$repo" && mkdir "$repo/src" && git -C "$repo" commit -q --allow-empty -m init
git -C "$repo" worktree add -q -b feature "$SANDBOX/wt-feature"
git -C "$repo" worktree add -q --detach "$SANDBOX/wt-detached"
mkdir -p "$SANDBOX/plain/a/quite/long/folder/name/here"

FAILS=0 TOTAL=0
# Renders input JSON $2, with links shown as <url|text> and colors stripped, and compares to $3.
check() {
  local got
  got=$(printf '%s' "$2" | HOME=$SANDBOX /bin/bash "$SCRIPT" \
    | sed -E $'s/\033\\]8;;([^\a]+)\a([^\033]*)\033\\]8;;\a/<\\1|\\2>/g; s/\033\\[[0-9;]*m//g')
  TOTAL=$((TOTAL + 1))
  if [ "$got" = "$3" ]; then echo "PASS [$1]"; else echo "FAIL [$1]: got '$got', want '$3'"; FAILS=$((FAILS + 1)); fi
}

origin='"repo": {"host": "github.com", "owner": "me", "name": "my-repo"}'
check "repo root, linked to origin" \
  "{\"model\":{\"display_name\":\"Opus\"},\"output_style\":{\"name\":\"default\"},\"workspace\":{\"current_dir\":\"$repo\",$origin}}" \
  "<https://github.com/me/my-repo|my-repo> (main)"
check "subfolder keeps the path within the repo" \
  "{\"workspace\":{\"current_dir\":\"$repo/src\",$origin}}" \
  "<https://github.com/me/my-repo|my-repo>/src (main)"
check "compact JSON parses the same" \
  "{\"workspace\":{\"current_dir\":\"$repo\",\"repo\":{\"host\":\"github.com\",\"owner\":\"me\",\"name\":\"my-repo\"}}}" \
  "<https://github.com/me/my-repo|my-repo> (main)"
check "no origin: folder name, no link" \
  "{\"workspace\":{\"current_dir\":\"$repo\"}}" \
  "myrepo (main)"
check "linked worktree names the main repo and the worktree" \
  "{\"workspace\":{\"current_dir\":\"$SANDBOX/wt-feature\",\"git_worktree\":\"wt-feature\"}}" \
  "myrepo ⎇wt-feature (feature)"
check "detached HEAD shows a short sha" \
  "{\"workspace\":{\"current_dir\":\"$SANDBOX/wt-detached\",\"git_worktree\":\"wt-detached\"}}" \
  "myrepo ⎇wt-detached ($(git -C "$repo" rev-parse --short=7 HEAD))"
check "outside a repo: ~-relative path" \
  "{\"workspace\":{\"current_dir\":\"$SANDBOX/plain\"}}" \
  "~/plain"
check "outside a repo, long: last two folders" \
  "{\"workspace\":{\"current_dir\":\"$SANDBOX/plain/a/quite/long/folder/name/here\"}}" \
  "…/name/here"
check "filesystem root" \
  "{\"workspace\":{\"current_dir\":\"/\"}}" \
  "/"

echo "$((TOTAL - FAILS))/$TOTAL passed"
[ "$FAILS" -eq 0 ]
