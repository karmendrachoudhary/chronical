# Generated Index Files

Chronicle generates `_INDEX.md` at the project root and, as of Phase 6, selective per-folder `_INDEX.md` files.

Plain English: this file is a small map of the project. It helps a future coding agent or human understand what changed recently and which files matter without scanning the whole repo.

## Recommendation

Use `_INDEX.md` for Chronicle-generated maps.

Why:

- It is clearly a generated index, not instructions for an agent.
- It is easy to find at the top of a folder listing.
- It avoids competing with `AGENTS.md`, `CLAUDE.md`, or similar files that usually contain behavior instructions.
- It can be regenerated safely because people are less likely to hand-edit it.

## Trade-Offs

- `AGENTS.md` and `CLAUDE.md` may be read automatically by some tools, but they sound instructional. Chronicle maps should describe the project, not tell the agent how to behave.
- `README.md` is familiar, but projects already use it for human-facing documentation. Rewriting it automatically would be risky.
- `_INDEX.md` is explicit and low-risk, but agents may need to be told to read it until future integrations teach them to look for it.

## Current Scope

Phase 6 writes:

- one root `_INDEX.md`, always;
- per-folder `_INDEX.md` files only when the folder has enough tracked files or related Chronicle items to be useful.

The default threshold is `minFiles: 3` or `minItems: 2`. This keeps the repo clean. A folder with one obvious file does not need a generated map.

Run:

```bash
npm run render:indexes
```

Chronicle also refreshes indexes when `render brain`, `capture --render`, `import superpowers --render`, or `actions apply --render` runs.

## Stale Cleanup

Generated index files start with a Chronicle marker. Chronicle only removes stale folder indexes that contain that marker. It will not delete a hand-written `_INDEX.md` that does not start with the marker.

## Privacy

Index files are private by default. They can contain local file paths and project structure. They must not be auto-published to public pages.
