---
name: chronicle
description: Use Chronicle to capture AI coding sessions into data/chronicle.json and render the private devlog, project-brain page, and root index.
---

Chronicle is a local project-brain tool. Use `chronicle capture` for hook-driven capture, `chronicle render personal` to rebuild the simpler private devlog, and `chronicle render brain` to rebuild the richer project-brain page plus `_INDEX.md`.
Use `chronicle validate` after manual item edits.

Important defaults:

- Items are private unless explicitly changed later.
- Public publishing is not implemented yet.
- The project brain and `_INDEX.md` are private local artifacts.
- Validation rejects unsafe public text.
