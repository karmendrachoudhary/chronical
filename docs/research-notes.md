# Step 0 Research Notes

Research date: 2026-05-29.

Chronicle's rule is capture once, render many. The research confirmed that our useful layer is presentation and event normalization, not a replacement memory engine.

## Existing Projects

| Project | What it does | License | Chronicle decision |
| --- | --- | --- | --- |
| `thedotmack/claude-mem` | Cross-agent memory system that captures, compresses, stores, searches, and injects session context. | Apache-2.0 | Do not depend in Phase 1. Consider optional import later. |
| `rohitg00/agentmemory` | MCP/REST persistent memory service for multiple agents. | Apache-2.0 | Do not depend in Phase 1. Consider optional adapter later. |
| `daaain/claude-code-log` | Python CLI that parses Claude Code JSONL transcripts and renders HTML/Markdown logs. | MIT | Use as a reference for transcript ideas, not as a dependency yet. |
| `DazzleML/claude-session-logger` | Claude Code hooks/plugin logger for transcripts, shell logs, and session metadata. | GPL-3.0 | Do not depend on or copy code because GPL-3.0 is too restrictive for Chronicle's planned open-source package. |
| `obra/superpowers` | Agentic-skills framework that works across Claude Code, Codex, Gemini CLI, Cursor, OpenCode, and similar tools. It guides work through specs, plans, task execution, and phase/task completion workflows. | MIT | Phase 6 integrates with it by reading artifacts. Chronicle does not compete with or reimplement its methodology. |

## Superpowers Integration Decision

Superpowers drives the work. Chronicle records and presents the work.

The useful artifacts for Chronicle are structured Markdown outputs, especially:

- specs and design documents under paths like `docs/superpowers/specs/`;
- implementation plans under paths like `docs/superpowers/plans/`;
- plan checkboxes and task/phase completion notes;
- transcript mentions of Superpowers skills completing a plan step.

Implemented Phase 6 mapping:

- A Superpowers spec becomes a private `feature` item.
- Decision/tradeoff/architecture bullets inside a spec become private `decision` items.
- A Superpowers implementation plan becomes one or more `roadmap` items.
- A completed plan task, where every checkbox in that task is checked, becomes a shipped `feature` item plus a timeline `event` item.
- Related files listed in the plan populate item `links.files`.

Chronicle should read these files as input, never require Superpowers as a runtime dependency.

## Hook Support

- Claude Code supports lifecycle hooks including `SessionStart`, `Stop`, `PreCompact`, and `PostToolUse`. Chronicle's example uses `Stop` and should be merged into `.claude/settings.json`.
- Codex supports lifecycle hooks including `SessionStart`, `Stop`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, and `PostToolUse`. Codex `Stop` is turn-scoped, and Codex can load plugin-bundled hooks from `hooks/hooks.json`.
- Gemini CLI supports hooks including `SessionStart`, `SessionEnd`, `BeforeTool`, `AfterTool`, `BeforeAgent`, `AfterAgent`, and `PreCompress`. Gemini `SessionEnd` is best-effort and does not wait for completion, so Chronicle uses `AfterAgent` for reliable writes.

Detailed cross-tool notes live in `docs/cross-tool-support.md`.

## Current Architecture Decision

Current v2 implementation consumes hook input and transcript files directly, writes durable Markdown source files under `chronicle/`, syncs a generated unified `items` cache, and renders the private project brain as the main artifact. Claude Code and Codex are plugin-supported. Gemini remains experimental. Team/public views, Superpowers import, and action intents exist, but the core product story still stays focused on onboarding and handoff.

## Source Links

- Claude Code hooks guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex plugin packaging: https://developers.openai.com/codex/plugins/build
- Gemini CLI hooks overview: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/index.md
- Gemini CLI hooks reference: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md
- Superpowers repository: https://github.com/obra/superpowers
