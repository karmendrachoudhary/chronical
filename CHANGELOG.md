# Changelog

## 2.0.0 - 2026-05-30

- Adds Claude Code plugin packaging with `.claude-plugin/plugin.json`, a local marketplace file, and a Claude-specific bundled `Stop` hook.
- Adds Claude Code slash skills such as `/chronicle:render-brain`, `/chronicle:team-report`, `/chronicle:public-draft`, and `/chronicle:validate`.
- Updates Codex plugin metadata to v2 and adds a repo-local Codex marketplace at `.agents/plugins/marketplace.json`.
- Documents native install flows for Claude Code and Codex while keeping `chronicle-devlog` as the shared CLI engine.
- Clarifies the adapter strategy for future OpenCode, Plod, Gemini, and Hermes-style hosts.

## 1.0.0 - 2026-05-29

- Reframes v1 around the onboarding and handoff project-brain wedge.
- Treats Claude Code and Codex as the v1-supported capture tools.
- Writes durable Chronicle source files to Markdown under `chronicle/` and syncs `data/chronicle.json` as a generated cache.
- Adds atomic writes with backups for generated source/cache/render outputs.
- Adds generated `CLAUDE.md` folder maps with freshness metadata alongside `_INDEX.md` maps.
- Adds a lightweight architecture snapshot to the project-brain HTML.
- Requires explicit approval before applying browser-exported action intents.
- Adds CI and release-checklist documentation for v1 hardening.

## 0.6.0 - 2026-05-29

- Added open-source packaging metadata, Codex plugin manifest, screenshots, and contribution/security docs.
- Added Superpowers import, action intents, generated indexes, team report, and public build log flows.
