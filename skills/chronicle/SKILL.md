---
name: chronicle
description: Use Chronicle to capture AI coding sessions into data/chronicle.json and render private, team, and public-safe views.
---

Chronicle is a local project-brain tool. Use `chronicle capture` for hook-driven capture, `chronicle render personal` to rebuild the simpler private devlog, `chronicle render brain` to rebuild the richer project-brain page plus `_INDEX.md`, `chronicle render team` to rebuild the filtered team report, and `chronicle public draft` to review the public build log before shipping.
Use `chronicle validate` after manual item edits.

Important defaults:

- Items are private unless explicitly changed later.
- Public publishing is allowlist-only and requires `chronicle public ship --approve`.
- The project brain and `_INDEX.md` are private local artifacts.
- The team report skips private items and never renders raw summaries.
- The public page only renders `public_summary` from `visibility: public` items.
- Validation rejects unsafe public text.
