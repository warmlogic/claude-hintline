# hintline

Session info for Claude Code that costs (almost) nothing to draw. Two pieces, usable separately:

- **The plugin** adds model, context, and rate-limit usage to the dim hint line under the prompt, drawn in-process by a [mod](https://code.claude.com/docs/en/plugins/mods/reference.md) (function hooks), so it launches no processes:

  ```text
  Opus 5.5 · 417k/1M · 5h: 63% ↺1h44m
  ```

  It shows the shortest rate-limit window Claude Code reports (today the 5-hour one) always, and any longer window, such as the weekly `7d: 81% ↺2d06h`, only once it's at least 50% used. Labels come from the window's name (`five_hour` → `5h`), so a new window shows up without a code change; a name in any other shape is shown as given.

- **`statusline/statusline.sh`** is an optional [status line](https://code.claude.com/docs/en/statusline) script for where the session is: the repo name (a clickable link to its `origin`), the path within it, the linked worktree, and the branch. Outside a repo it shows the `~`-relative path. It launches nothing but `/bin/bash` itself:

  ```text
  my-repo/src (main)
  my-repo ⎇feature-wt (feature/x)
  ~/Documents/notes
  ```

Claude Code's own footer already shows the branch's `PR #N` with its review state, so neither piece repeats it.

## Why

A status line script runs on every refresh of every session. A typical one starts `jq` once per field plus a few `git` calls, which is 10+ process launches per refresh. On a laptop with an endpoint-security agent (EDR) that inspects every process launch, those launches add up to real CPU. This plugin draws the usage figures from inside Claude Code, and the script reads everything it needs with bash builtins: fields from the JSON input with pattern matching, the branch straight from `.git/HEAD`, and the repo identity from the `workspace.repo` field Claude Code already provides.

## Install

```text
/plugin marketplace add warmlogic/ai-plugin-marketplace
/plugin install hintline@ai-plugin-marketplace
```

The plugin needs a Claude Code build with mods (function-hook plugins). The mod API is early access and may change between releases.

### The status line (optional)

Plugins can't set the main status line, so this part is a copy-and-configure step. Copy `statusline/statusline.sh` to `~/.claude/statusline.sh`, then add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/bin/bash ~/.claude/statusline.sh"
  }
}
```

`/bin/bash` is deliberate. On macOS it starts in about 4 ms, versus about 10 ms for a Homebrew `bash` found first on `PATH`, and the script is written to run on its bash 3.2. A custom status line hides most of Claude Code's footer keyboard hints (`esc to interrupt`, `? for shortcuts`); that's Claude Code's behavior for any status line.

Repo links are [OSC 8](https://en.wikipedia.org/wiki/ANSI_escape_code#OSC) hyperlinks (Cmd+click on macOS), which need a terminal that supports them, such as iTerm2, Kitty, or WezTerm.

## Limits

- The status line matches JSON fields with bash patterns rather than a JSON parser, so a working directory containing a literal `"` shows wrong. That's the price of launching nothing.
- The usage figures refresh after each turn and every 30 seconds, so the countdown can lag by up to half a minute.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
