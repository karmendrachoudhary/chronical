# Security Policy

Chronicle is designed to be private by default.

## What to Report

Please open a GitHub issue if you find a way for Chronicle to:

- publish `raw_summary`, `summary`, file paths, transcript paths, or `source_ref` in a public page;
- publish secret-looking text such as API keys or tokens;
- run commands from the static HTML project-brain page;
- apply an unsafe or unexpected action intent;
- delete or overwrite non-generated files during index generation.

## Current Safety Model

- Captured items default to `visibility: private`.
- The public page is allowlist-only and only reads `public_summary` from `visibility: public` items.
- Public shipping requires `--approve`.
- The project-brain page queues action intents but does not edit files directly.
- Generated `_INDEX.md` cleanup only removes files that start with Chronicle's generated marker.

See `docs/safety.md` for the detailed rules.
