# Generated Index Files

Chronicle generates `_INDEX.md` at the project root and selective per-folder `_INDEX.md` plus `CLAUDE.md` files.

Plain English: this file is a small map of the project. It helps a future coding agent or human understand what changed recently and which files matter without scanning the whole repo.

## Recommendation

Use `_INDEX.md` for human-readable maps, and `CLAUDE.md` for agent-readable folder maps in folders that are complex enough to warrant one.

Why:

- `_INDEX.md` is clearly a generated index, not behavior instructions.
- `CLAUDE.md` is more likely to be noticed by Claude Code and similar tools, so Chronicle uses it as a generated map, not an instruction override.
- Both files start with a Chronicle generated marker and can be regenerated safely.
- Root-first still matters: Chronicle avoids cluttering every folder.

## Trade-Offs

- `CLAUDE.md` may be read automatically by Claude Code. That is useful, but Chronicle must keep it descriptive and clearly generated.
- `AGENTS.md` is broader, but using it in v1 would risk overriding project instructions in more tools.
- `README.md` is familiar, but projects already use it for human-facing documentation. Rewriting it automatically would be risky.

## Current Scope

Current v1 behavior writes:

- one root `_INDEX.md`, always;
- per-folder `_INDEX.md` files only when the folder has enough tracked files or related Chronicle items to be useful;
- matching per-folder `CLAUDE.md` agent maps for those same useful folders.

The default threshold is `minFiles: 3` or `minItems: 2`. This keeps the repo clean. A folder with one obvious file does not need a generated map.

Run:

```bash
npm run render:indexes
```

Chronicle also refreshes indexes when `render brain`, `capture --render`, `import superpowers --render`, or `actions apply --render` runs.

## Stale Cleanup

Generated index files start with a Chronicle marker. Chronicle only removes stale folder indexes that contain that marker. It will not delete a hand-written `_INDEX.md` or `CLAUDE.md` that does not start with the marker.

## Freshness

Folder `CLAUDE.md` maps include the git head used when they were generated and whether the folder had uncommitted changes. This is Chronicle's honest claim: the map tells you when it may be stale instead of pretending it is always perfect.

## Privacy

Index files are private by default. They can contain local file paths and project structure. They must not be auto-published to public pages.
