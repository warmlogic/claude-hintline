# AGENTS.md — hintline developer guide

This is the canonical contributor guide, at the repo root. `.claude/CLAUDE.md` is a symlink to this file, so Claude Code loads the same content as project memory.

A Claude Code plugin (a mod: TypeScript function hooks run in-process by Claude Code) that appends model, context, and rate-limit usage to the prompt hint, plus an optional status line script. The design goal is zero process launches per refresh.

## Checks

```bash
claude plugin validate .          # manifest + what the module hooks and calls ("No version specified" is expected)
claude plugin test .              # hooks/*.test.ts, via claude-code/testing
tsc -p .                          # type-check; the types are laid on first load (see below)
bash tests/test-statusline.sh     # status line script, hermetic (mktemp repos)
```

All four must pass before committing. `tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code writes (gitignored) the first time it loads the mod from a folder you own: run `claude --plugin-dir .` once.

## Project layout

```text
hooks/
  hooks.json        # { "modules": ["./register.ts"] }
  register.ts       # hooks: refresh on session.start / turn.complete / a 30 s clock; draw on ui.render PromptHint
  line.ts           # pure formatting (no `$`), so tests drive it directly
  line.test.ts
types/index.d.ts    # $.state contract: 'hintline'.usage
statusline/
  statusline.sh     # optional status line script; users copy it (plugins can't set statusLine)
tests/
  test-statusline.sh
```

## Non-obvious design decisions

- **Refresh in events, read in render.** `session.start`, `turn.complete`, and a 30-second `$.clock.every` measure the figures and store them in a `$.state` atom; the `PromptHint` render hook only reads the atom, since it runs per draw. A write to the atom redraws its readers.
- **Compose, never replace.** `PromptHint`'s `tail` is one string every plugin shares, so the hook appends to `e.props.tail` and never rewrites `hint` (which would replace Claude Code's own line). The terminal draws `tail` dim only.
- **No band, no pinned status.** The `AbovePrompt` band leaves a blank row beneath it that a plugin can't remove, and `$.ui.status` is drawn with a forced `⚠ <plugin>:` label. The hint tail has neither.
- **Failures are logged, never raised.** `refresh` catches and logs to `$.ui.log`, so a failed measurement leaves the last figures in place and never breaks the hook it rode on.
- **Rate-limit windows are data, not code.** Every window in `$.session.usage().rateLimits` is a candidate; `<number word>_<hour|day|week>` kinds get a short label (`5h`, `7d`), and any other kind (`spend_limit`) is shown as given rather than guessed at. The shortest window always shows and the rest only from 50% used, which keeps the dim, right-truncated hint short.
- **Model names are parsed, never guessed.** `prettyModel` names an ID only when it matches `claude-<family>-<major>[-<minor>]` with the known suffixes; anything else, including the older `claude-3-5-sonnet` order, is shown raw.
- **No PR number.** Claude Code's footer already shows `PR #N` with its review state (`prStatusFooterEnabled`).
- **The status line's input keys** (`workspace.current_dir`, `workspace.git_worktree`, `workspace.repo.{host,owner,name}`) are defined in Claude Code's [status line docs](https://code.claude.com/docs/en/statusline); a key that changes degrades silently to the folder-name fallback.
- **The status line launches nothing.** Bash pattern matching instead of `jq`, `.git/HEAD` instead of `git`, `workspace.repo` (parsed from `origin` by Claude Code) for the link, and only `${var}`-braced expansions next to non-ASCII glyphs: bash 3.2 reads the bytes of `⎇` as part of an unbraced variable name. `workspace.repo`'s keys are matched inside that object only, since other objects also have a `name`.

## Unversioned

No `version` field, here or in the marketplace catalog entry: Claude Code keys an unversioned install by the source's commit SHA, so every merge to `main` is a release. The catalog entry's `description` must equal `.claude-plugin/plugin.json`'s, verbatim.
