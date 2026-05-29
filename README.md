# Chronicle

Chronicle turns AI coding sessions into a private, self-updating devlog and project brain.

Phase 1 through Phase 4 are working: Chronicle can capture a session, store it in one unified data file, validate safety rules, render the private personal devlog, render the richer project-brain HTML page, render a team-safe report, and regenerate a root `_INDEX.md` map for agents and humans.

## What Works Now

- Capture from hook JSON on stdin or from a fixture file.
- Parse local JSONL transcripts from Claude Code, Codex, or Gemini-style sessions.
- Store clean unified items in `data/chronicle.json`.
- Render a self-contained personal devlog HTML file.
- Render the full project-brain HTML page with Overview, Features, Files, Timeline, Decisions, Roadmap, cross-links, and Command-K search.
- Render a team report that only shows `visibility: team` and `visibility: public` items.
- Regenerate the root `_INDEX.md` project map from the same Chronicle data.
- Keep every item `private` by default.
- Flag likely secrets and keep those items private.
- Validate the unified schema and public-safety rules.

Public publishing, action intents, per-folder indexes, Superpowers ingestion, approval gates, and GitHub Pages deploys are planned for later phases.

## Try It Locally

This repo uses Node.js 20 or newer.

```bash
npm test
npm run capture:sample
npm run validate
open dist/devlog.html
open dist/project-brain.html
open dist/team-report.html
```

The sample command reads `tests/fixtures/claude-session.jsonl`, appends one private event item to `data/chronicle.json`, renders the personal devlog, renders the project brain, renders the team report, and refreshes `_INDEX.md`.

## Main Commands

```bash
node ./bin/chronicle.js capture --hook-input - --source-tool claude-code --render --hook-mode
node ./bin/chronicle.js render personal --store data/chronicle.json --output dist/devlog.html
node ./bin/chronicle.js render brain --store data/chronicle.json --output dist/project-brain.html --index _INDEX.md
node ./bin/chronicle.js render team --store data/chronicle.json --output dist/team-report.html
node ./bin/chronicle.js validate --store data/chronicle.json
```

Plain language version:

- `capture` reads what the coding tool gives Chronicle at the end of a session.
- Chronicle turns that messy transcript into one clean event item.
- `render personal` rebuilds the private HTML page from the Chronicle data file.
- `render brain` rebuilds the richer project brain and root `_INDEX.md` from that same data file.
- `render team` rebuilds a team-safe HTML report from explicitly shared items.
- `validate` checks the Chronicle data file against the schema and safety rules.

## Team Report Safety

The team report is filtered. It skips `private` items, never renders `raw_summary`, and never renders file paths from `files`.

For `visibility: team`, it uses the item `summary`. For `visibility: public`, it uses `public_summary` only. Plain English: team items can include internal status, but public items still follow the stricter public-summary rule.

## Claude Code Hook Example

Copy `hooks/claude/hooks.json` into `.claude/hooks.json`, or adapt the command into your existing Claude Code hook config.

The hook runs on `Stop` and calls:

```bash
node "$(git rev-parse --show-toplevel)/bin/chronicle.js" capture --hook-input - --source-tool claude-code --render --hook-mode
```

## Codex Hook Example

Copy `hooks/codex/hooks.json` into `.codex/hooks.json`, or install Chronicle as a Codex plugin. The root `hooks/hooks.json` is the plugin-bundled Codex hook config.

## Gemini Hook Example

Copy the `hooks` object from `hooks/gemini/settings.json` into your `.gemini/settings.json` file.

Gemini uses `SessionEnd`, so it is closer to a true session-end capture than Claude/Codex `Stop`, which can be turn-scoped.

## Data Model

The schema is documented in `docs/schema.md` and machine-readable at `schemas/item.schema.json`.

Important default: items are private unless a later phase explicitly marks them public.

Safety rules are documented in `docs/safety.md`.

Generated index-file trade-offs are documented in `docs/generated-indexes.md`.

## Optional Summarizer

Chronicle uses an offline summarizer by default. If you later want an LLM pass, set `capture.summarizerCommand` in `chronicle.config.json`. Chronicle sends parsed session JSON to that command on stdin and expects a JSON summary on stdout. If the command fails, Chronicle falls back to the offline summary.

## Research Foundation

Chronicle does not try to replace memory systems. The research notes are in `docs/research-notes.md`.

Chronicle stands on:

- Official hook systems from Claude Code, Codex, and Gemini CLI.
- Raw local transcript files where the tool exposes them.
- Ideas from `daaain/claude-code-log` about reading Claude JSONL transcripts.
- Superpowers artifacts are planned as a read-only integration. Superpowers drives work; Chronicle records and presents it.

Chronicle does not depend on GPL-licensed session logger code.

## Current Roadmap

1. Phase 1: capture pipeline and personal devlog proof.
2. Phase 2: unified item schema, summarization, validation, and safety.
3. Phase 3: full project-brain page with Overview, Features, Files, Timeline, Decisions, Roadmap, cross-links, Command-K search, and root `_INDEX.md`.
4. Phase 4: team report view.
5. Phase 5: public build-in-public page with approval and GitHub Pages publishing.
6. Phase 6: Superpowers ingestion, action intents, and generated folder indexes.
7. Phase 7: cross-tool and open-source polish.
