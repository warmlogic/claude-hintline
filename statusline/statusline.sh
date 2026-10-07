#!/bin/bash
# Claude Code status line: where this session is. Repo (a clickable link to its
# origin), path within the repo, linked worktree, and branch; outside a repo,
# the ~-relative path. Model and usage live in the hintline mod's prompt hint.
#
# Runs on every refresh of every session, and each process launch is expensive
# under endpoint-security agents, so this launches nothing: no jq, no git, no
# subshells. JSON fields are matched with bash patterns, which breaks only on a
# path containing a literal `"`. Works on macOS /bin/bash 3.2.

# read -d '' reads to EOF with a builtin (a $(...) would fork); its nonzero exit at EOF is expected
IFS= read -r -d '' input

# Sets the variable named $1 to that key's string value, matched in text $2 (default: the input).
field() {
  local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""
  [[ ${2-$input} =~ $re ]] && printf -v "$1" '%s' "${BASH_REMATCH[1]}"
}

current_dir='' git_worktree='' host='' owner='' name=''
field current_dir
field git_worktree
# workspace.repo's keys, matched inside its own object so `name` is not another object's
repo_re='"repo"[[:space:]]*:[[:space:]]*\{([^}]*)\}'
if [[ $input =~ $repo_re ]]; then
  repo_json=${BASH_REMATCH[1]}
  field host "$repo_json"
  field owner "$repo_json"
  field name "$repo_json"
fi

cwd=${current_dir:-$PWD}
yellow=$'\033[33m' magenta=$'\033[35m' cyan=$'\033[36m' reset=$'\033[0m'

# Repo root: the nearest folder holding .git (a directory, or a worktree's pointer file)
root=$cwd
while [ -n "$root" ] && [ ! -e "$root/.git" ]; do root=${root%/*}; done

if [ -z "$root" ]; then
  # Not in a repo: ~-relative path, or its last two folders when long
  path=$cwd
  case $path in "$HOME" | "$HOME"/*) path="~${path#"$HOME"}" ;; esac
  if [ ${#path} -gt 30 ]; then
    parent=${cwd%/*}
    if [ -n "$parent" ]; then path="…/${parent##*/}/${cwd##*/}"; else path=$cwd; fi
  fi
  printf '%s%s%s\n' "$yellow" "${path:-/}" "$reset"
  exit 0
fi

# Branch from HEAD, following a worktree's `gitdir:` pointer
gitdir=$root/.git
if [ -f "$gitdir" ]; then
  read -r _ gitdir <"$gitdir"
  case $gitdir in /*) ;; *) gitdir=$root/$gitdir ;; esac
fi
branch=''
if [ -r "$gitdir/HEAD" ] && read -r head <"$gitdir/HEAD"; then
  case $head in
    "ref: refs/heads/"*) branch=${head#ref: refs/heads/} ;;
    *) branch=${head:0:7} ;;
  esac
fi

# Repo name: origin's when Claude Code parsed one, else the main checkout's
# folder (a linked worktree's gitdir is <main>/.git/worktrees/<name>), linked
# to its origin when there is one (OSC 8: Cmd+click)
main=${gitdir%/.git/worktrees/*}
main=${main%/.git}
label=${name:-${main##*/}}
if [ -n "$host" ] && [ -n "$owner" ] && [ -n "$name" ]; then
  label=$'\033]8;;'"https://$host/$owner/$name"$'\a'"$label"$'\033]8;;\a'
fi

line="${yellow}${label}${cwd#"$root"}${reset}"
if [ -n "$git_worktree" ]; then
  line="${line} ${cyan}⎇${git_worktree}${reset}"
fi
if [ -n "$branch" ] && [ "$branch" != "$git_worktree" ]; then
  line="${line} ${magenta}(${branch})${reset}"
fi
printf '%s\n' "$line"
