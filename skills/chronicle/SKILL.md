---
name: chronicle
description: Use Chronicle to capture AI coding sessions into Markdown source files and render private, team, and public-safe views.
---

Chronicle is a local project-brain tool. Its durable source of truth is Markdown under `chronicle/`; `data/chronicle.json` is a generated cache used by renderers. Use `chronicle capture` for hook-driven capture, `chronicle render brain` to rebuild the main project-brain page plus indexes, `chronicle render team` to rebuild the filtered team report, `chronicle public draft` to review the public build log before shipping, and `chronicle import superpowers` to ingest Superpowers specs/plans.
Use `chronicle validate` after manual item edits.

Important defaults:

- Items are private unless explicitly changed later.
- Public publishing is allowlist-only and requires `chronicle public ship --approve`.
- The project brain and `_INDEX.md` are private local artifacts.
- The team report skips private items and never renders raw summaries.
- The public page only renders `public_summary` from `visibility: public` items.
- Superpowers import is read-only for `docs/superpowers/**` and writes Chronicle Markdown source items.
- The project-brain page queues action intents; review them, then apply them with `chronicle actions apply --approve` in the next agent session.
- Validation rejects unsafe public text.
- Cross-tool support details are documented in `docs/cross-tool-support.md`.
