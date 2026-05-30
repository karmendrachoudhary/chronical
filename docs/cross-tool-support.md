# Cross-Tool Support

Last checked: 2026-05-30.

Chronicle v2 treats Claude Code and Codex as plugin-supported. Gemini CLI support is present but experimental because its reliable hook point is turn-level, not true session-end.

Chronicle uses the same CLI command everywhere:

```bash
node "$(git rev-parse --show-toplevel)/bin/chronicle.js" capture --hook-input - --source-tool <tool> --render --hook-mode
```

Plain English: each coding tool sends JSON to Chronicle. Chronicle reads that JSON, optionally reads the transcript path from it, writes one private Markdown source item under `chronicle/`, syncs the generated JSON cache, and refreshes the local HTML/index outputs.

## Current Support Matrix

| Tool | Capture status | Recommended hook | Config/plugin files | Notes |
| --- | --- | --- | --- | --- |
| Claude Code | Supported plugin | `Stop` | `.claude-plugin/plugin.json`, `hooks/claude-plugin/hooks.json`, `skills/**` | Provides `/chronicle:*` slash commands plus bundled capture hook. Manual fallback: `.claude/settings.json`. |
| Codex | Supported plugin | `Stop` | `.codex-plugin/plugin.json`, `hooks/hooks.json`, `skills/**`, `.agents/plugins/marketplace.json` | Codex `Stop` is turn-scoped. Codex uses `/plugins`, `/skills`, and `/hooks` rather than plugin-defined custom slash commands. Manual fallback: `.codex/hooks.json`. |
| Gemini CLI | Experimental turn-level capture | `AfterAgent` | `.gemini/settings.json` | Gemini's `SessionEnd` is best-effort and does not wait for completion, so Chronicle uses `AfterAgent` for reliable writes. |
| OpenCode / Plod / Hermes hosts | Planned | Unknown | Not implemented | Add thin adapters after their plugin specs are confirmed. They should call the same `chronicle` CLI. |

## Hook Files in This Repo

- Claude Code plugin hook: `hooks/claude-plugin/hooks.json`
- Claude Code manual hook example: `hooks/claude/hooks.json`
- Codex plugin-bundled hook: `hooks/hooks.json`
- Codex manual hook example: `hooks/codex/hooks.json`
- Gemini CLI example: `hooks/gemini/settings.json`

For Claude Code, install the plugin when possible; otherwise merge `hooks/claude/hooks.json` into `.claude/settings.json`. For Codex, install the plugin when possible; otherwise copy `hooks/codex/hooks.json` to `.codex/hooks.json`. For Gemini CLI, merge the `hooks` object into `.gemini/settings.json`.

Plugin-specific install notes live in:

- `docs/claude-code-plugin.md`
- `docs/codex-plugin.md`
- `docs/plugin-adapters.md`

## Why Gemini Uses `AfterAgent`

Gemini CLI documents `SessionEnd`, but it is advisory and the CLI does not wait for it to complete. That is risky for Chronicle because writing Markdown source and the generated JSON cache needs to finish cleanly.

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
