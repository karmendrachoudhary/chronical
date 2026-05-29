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
| `obra/superpowers` | Agentic-skills framework that works across Claude Code, Codex, Gemini CLI, Cursor, OpenCode, and similar tools. It guides work through specs, plans, task execution, and phase/task completion workflows. | MIT | Integrate with it by reading artifacts. Do not compete with or reimplement its methodology. |

## Superpowers Integration Decision

Superpowers drives the work. Chronicle records and presents the work.

The useful artifacts for Chronicle are structured Markdown outputs, especially:

- specs and design documents under paths like `docs/superpowers/specs/`;
- implementation plans under paths like `docs/superpowers/plans/`;
- plan checkboxes and task/phase completion notes;
- transcript mentions of Superpowers skills completing a plan step.

Mapping plan:

- A Superpowers spec becomes a `decision` or `feature` item, depending on content.
- A Superpowers implementation plan becomes one or more `roadmap` items.
- A completed phase becomes a `feature` item plus a timeline `event` item.
- Related files listed in the plan populate item `links.files`.

Chronicle should read these files as input, never require Superpowers as a runtime dependency.

## Hook Support

- Claude Code supports lifecycle hooks including `SessionStart`, `Stop`, `PreCompact`, and `PostToolUse`.
- Codex supports lifecycle hooks including `SessionStart`, `Stop`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, and `PostToolUse`.
- Gemini CLI supports hooks including `SessionStart`, `SessionEnd`, `BeforeTool`, `AfterTool`, `BeforeAgent`, `AfterAgent`, and `PreCompress`.

## Phase 1 Through 3 Decision

Phase 1 consumes hook input and transcript files directly. Phase 2 stores captured work as unified `items`, not events only. Phase 3 renders the private project brain and root `_INDEX.md` from that same item list. This keeps Chronicle small, transparent, and independent while still allowing future imports from memory tools and Superpowers artifacts.
