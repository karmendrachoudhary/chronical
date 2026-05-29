# Contributing to Chronicle

Thanks for helping improve Chronicle. This project is intentionally small and readable because it should be approachable for newer developers and easy for coding agents to inspect.

## Local Setup

```bash
git clone https://github.com/karmendrachoudhary/chronical.git
cd chronical
npm test
npm run validate
npm run capture:sample
open dist/project-brain.html
```

Node.js 20 or newer is required.

## Development Loop

Use this loop for most changes:

```bash
npm test
npm run validate
npm run render:brain
```

Plain English: tests check behavior, validation checks the Chronicle data file, and render verifies the main HTML output can still be generated.

## Project Shape

- `src/capture/`: turns hook input and transcripts into Chronicle Markdown source items.
- `src/source/`: reads/writes the Markdown source of truth and syncs the JSON cache.
- `src/render/`: renders HTML and generated index files from the item store.
- `src/public/`: drafts and ships the public build log.
- `src/integrations/`: imports artifacts from tools such as Superpowers.
- `src/actions/`: applies safe action-intent files exported from the project brain.
- `schemas/`: documents the machine-readable data shapes.
- `hooks/`: example hook configs for Claude Code, Codex, and Gemini CLI.
- `docs/`: human-readable architecture, safety, and contribution notes.

## Safety Rules for Changes

- New items must default to `visibility: private`.
- Durable Chronicle data should be written to Markdown source first; `data/chronicle.json` is a generated cache.
- Public output must never render `summary`, `raw_summary`, `files`, `source_ref`, local paths, internal URLs, or secret-looking text.
- Static HTML pages must not edit files or run commands directly.
- Action intents must stay low-risk and explicit, and applying them must require human approval. Add a schema change and tests for every new action.

## Adding a New View

Read `docs/template-guide.md` first. New views should use the existing `items` model and add tests that prove private data does not leak.

## Pull Request Checklist

- Run `npm test`.
- Run `npm run validate` if you changed schema, capture, or sample data behavior.
- Run `npm run render:brain` if you changed renderers or styles.
- Run `npm pack --dry-run` before release changes.
- Update `README.md` or `docs/` when behavior changes.
- Keep code simple. Prefer clear names and small functions over clever abstractions.
