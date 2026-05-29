# Cross-Tool Support

Last checked: 2026-05-29.

Chronicle uses the same CLI command everywhere:

```bash
node "$(git rev-parse --show-toplevel)/bin/chronicle.js" capture --hook-input - --source-tool <tool> --render --hook-mode
```

Plain English: each coding tool sends JSON to Chronicle. Chronicle reads that JSON, optionally reads the transcript path from it, appends one private item to `data/chronicle.json`, and refreshes the local HTML/index outputs.

## Current Support Matrix

| Tool | Capture status | Recommended hook | Config file | Notes |
| --- | --- | --- | --- | --- |
| Claude Code | Supported | `Stop` | `.claude/settings.json` | Good fit for end-of-turn capture. Claude also documents `SessionStart`, `PostToolUse`, and `PreCompact`, which Chronicle can use later for richer capture. |
| Codex | Supported | `Stop` | `.codex/hooks.json` or plugin `hooks/hooks.json` | Codex `Stop` is turn-scoped, not whole-session scoped. Codex also supports plugin-bundled hooks, which Chronicle uses. |
| Gemini CLI | Supported with turn-level capture | `AfterAgent` | `.gemini/settings.json` | Gemini's `SessionEnd` is best-effort and does not wait for completion, so Chronicle uses `AfterAgent` for reliable writes. |

## Hook Files in This Repo

- Claude Code example: `hooks/claude/hooks.json`
- Codex example: `hooks/codex/hooks.json`
- Codex plugin-bundled hook: `hooks/hooks.json`
- Gemini CLI example: `hooks/gemini/settings.json`

For Claude Code, merge the `hooks` object into `.claude/settings.json`. For Codex, copy the file to `.codex/hooks.json` or install the plugin. For Gemini CLI, merge the `hooks` object into `.gemini/settings.json`.

## Why Gemini Uses `AfterAgent`

Gemini CLI documents `SessionEnd`, but it is advisory and the CLI does not wait for it to complete. That is risky for Chronicle because writing `data/chronicle.json` needs to finish cleanly.

So Chronicle's Gemini example uses `AfterAgent`. That means it captures after each completed agent turn instead of only when the whole CLI exits. This is less perfect semantically, but safer technically.

## Sources Checked

- Claude Code hooks guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Claude Code plugins: https://code.claude.com/docs/en/plugins
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex plugin packaging: https://developers.openai.com/codex/plugins/build
- Gemini CLI hooks overview: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/index.md
- Gemini CLI hooks reference: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md
- Superpowers: https://github.com/obra/superpowers
