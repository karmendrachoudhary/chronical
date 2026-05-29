---
name: chronicle
description: Use Chronicle to capture AI coding sessions into data/chronicle.json and render private, team, and public-safe views.
---

Chronicle is a local project-brain tool. Use `chronicle capture` for hook-driven capture, `chronicle render personal` to rebuild the simpler private devlog, `chronicle render brain` to rebuild the richer project-brain page plus indexes, `chronicle render team` to rebuild the filtered team report, `chronicle public draft` to review the public build log before shipping, and `chronicle import superpowers` to ingest Superpowers specs/plans.
Use `chronicle validate` after manual item edits.

Important defaults:

- Items are private unless explicitly changed later.
- Public publishing is allowlist-only and requires `chronicle public ship --approve`.
- The project brain and `_INDEX.md` are private local artifacts.
- The team report skips private items and never renders raw summaries.
- The public page only renders `public_summary` from `visibility: public` items.
- Superpowers import is read-only for `docs/superpowers/**` and upserts into `data/chronicle.json`.
- The project-brain page queues action intents; apply them with `chronicle actions apply` in the next agent session.
- Validation rejects unsafe public text.
- Cross-tool support details are documented in `docs/cross-tool-support.md`.
