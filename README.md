# Chronicle

Chronicle turns AI coding sessions into a private, self-updating devlog and project brain.

Phase 1 through Phase 6 are working: Chronicle can capture a session, store it in one unified data file, validate safety rules, render the private personal devlog, render the richer project-brain HTML page, render a team-safe report, draft and ship an approval-gated public build log, import Superpowers artifacts, queue safe action intents, and regenerate root plus usefulness-based folder `_INDEX.md` maps for agents and humans.

## What Works Now

- Capture from hook JSON on stdin or from a fixture file.
- Parse local JSONL transcripts from Claude Code, Codex, or Gemini-style sessions.
- Store clean unified items in `data/chronicle.json`.
- Render a self-contained personal devlog HTML file.
- Render the full project-brain HTML page with Overview, Features, Files, Timeline, Decisions, Roadmap, cross-links, and Command-K search.
- Render a team report that only shows `visibility: team` and `visibility: public` items.
- Draft a public build-in-public page from `visibility: public` items only.
- Ship the public page only after an explicit `--approve` flag, then record a release marker.
- Optionally publish the public HTML to the `gh-pages` branch for GitHub Pages.
- Import Superpowers specs and plans as Chronicle features, decisions, roadmap items, and completed timeline events.
- Queue safe browser action intents from the project-brain page, then apply them next session with the CLI.
- Regenerate the root `_INDEX.md` project map and selective per-folder `_INDEX.md` maps from the same Chronicle data.
- Keep every item `private` by default.
- Flag likely secrets and keep those items private.
- Validate the unified schema and public-safety rules.

Final cross-tool and open-source polish is planned for Phase 7.

## Try It Locally

This repo uses Node.js 20 or newer.

```bash
npm test
npm run capture:sample
npm run validate
open dist/devlog.html
open dist/project-brain.html
open dist/team-report.html
npm run public:draft -- --version v0.1.0
open dist/public-draft.html
npm run import:superpowers
npm run render:indexes
```

The sample command reads `tests/fixtures/claude-session.jsonl`, appends one private event item to `data/chronicle.json`, renders the personal devlog, renders the project brain, renders the team report, and refreshes `_INDEX.md`.

## Main Commands

```bash
node ./bin/chronicle.js capture --hook-input - --source-tool claude-code --render --hook-mode
node ./bin/chronicle.js render personal --store data/chronicle.json --output dist/devlog.html
node ./bin/chronicle.js render brain --store data/chronicle.json --output dist/project-brain.html --index _INDEX.md
node ./bin/chronicle.js render team --store data/chronicle.json --output dist/team-report.html
node ./bin/chronicle.js public draft --version v0.1.0 --store data/chronicle.json --output dist/public-draft.html
node ./bin/chronicle.js public ship --version v0.1.0 --approve --store data/chronicle.json --output dist/public/index.html
node ./bin/chronicle.js import superpowers --store data/chronicle.json --render
node ./bin/chronicle.js actions apply --actions chronicle-actions.json --store data/chronicle.json --render
node ./bin/chronicle.js render indexes --store data/chronicle.json --root .
node ./bin/chronicle.js validate --store data/chronicle.json
```

Plain language version:

- `capture` reads what the coding tool gives Chronicle at the end of a session.
- Chronicle turns that messy transcript into one clean event item.
- `render personal` rebuilds the private HTML page from the Chronicle data file.
- `render brain` rebuilds the richer project brain and root `_INDEX.md` from that same data file.
- `render team` rebuilds a team-safe HTML report from explicitly shared items.
- `public draft` builds a public-safe HTML draft from explicitly public items.
- `public ship` requires `--approve`, writes the final public HTML, and records a release marker.
- `import superpowers` reads Superpowers specs and plans without depending on Superpowers at runtime.
- `actions apply` applies the safe browser intents that you exported from the project-brain page.
- `render indexes` refreshes root and selective folder `_INDEX.md` map files.
- `validate` checks the Chronicle data file against the schema and safety rules.

## Superpowers Integration

Chronicle integrates with Superpowers by reading its artifacts, not by copying its workflow. Plain English: Superpowers drives the work; Chronicle records and presents the result.

Chronicle reads:

- `docs/superpowers/specs/*.md` as feature and decision items.
- `docs/superpowers/plans/*.md` as roadmap items.
- completed plan tasks where every checkbox is checked as shipped features and timeline events.

Run:

```bash
npm run import:superpowers
```

The import is read-only for Superpowers files. It upserts Chronicle items into `data/chronicle.json`, so rerunning the import refreshes changed specs/plans instead of duplicating them.

## Action Intents

The project-brain page can queue safe intents, such as marking a feature shipped or moving a roadmap item in progress. The page never edits files and never runs an agent. It stores the queue in your browser, then lets you copy or download `chronicle-actions.json`.

Next session, place that file at the repo root and run:

```bash
npm run actions:apply
```

Chronicle only accepts known safe actions: feature status changes and roadmap status changes.

## Public Build Log Safety

The public page is allowlist-only. Plain English: Chronicle publishes nothing unless you mark an item `visibility: public`, and even then the public renderer only uses `public_summary`, safe dates, safe type labels, and safe tech tags. It never renders `raw_summary`, private `summary`, file paths, transcript paths, or source references.

Draft first:

```bash
npm run public:draft -- --version v0.1.0
open dist/public-draft.html
```

After you review the draft, ship it locally:

```bash
npm run public:ship -- --version v0.1.0 --approve
```

To test the GitHub Pages path without pushing:

```bash
npm run public:ship -- --version v0.1.0 --approve --github-pages --dry-run
```

To publish to GitHub Pages, run the same command without `--dry-run`. Chronicle writes the generated file as `index.html` on the `gh-pages` branch and pushes that branch.

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
- Superpowers artifacts through a read-only import. Superpowers drives work; Chronicle records and presents it.

Chronicle does not depend on GPL-licensed session logger code.

## Current Roadmap

1. Phase 1: capture pipeline and personal devlog proof.
2. Phase 2: unified item schema, summarization, validation, and safety.
3. Phase 3: full project-brain page with Overview, Features, Files, Timeline, Decisions, Roadmap, cross-links, Command-K search, and root `_INDEX.md`.
4. Phase 4: team report view.
5. Phase 5: public build-in-public page with approval and GitHub Pages publishing.
6. Phase 6: Superpowers ingestion, action intents, and generated folder indexes.
7. Phase 7: cross-tool and open-source polish.
