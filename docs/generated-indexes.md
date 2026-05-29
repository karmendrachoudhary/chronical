# Generated Index Files

Chronicle generates `_INDEX.md` at the project root in Phase 3.

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

Phase 3 only writes the root `_INDEX.md`.

Per-folder index files are planned for Phase 6. They should be root-first and usefulness-based: generate one only for folders complex enough to need a map. Blanket index files in every folder would add clutter and waste agent context.

## Privacy

Index files are private by default. They can contain local file paths and project structure. They must not be auto-published to public pages.
