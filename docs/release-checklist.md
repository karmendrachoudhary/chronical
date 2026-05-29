# Chronicle v1 Release Checklist

Use this before tagging v1. The release claim is: Chronicle helps someone understand a codebase, see what changed, and hand it off through one private HTML project brain. Claude Code and Codex are supported in v1.

## Product Scope

- [ ] README clearly states the v1 wedge: onboarding and handoff.
- [ ] README clearly states v1 tool support: Claude Code and Codex.
- [ ] Gemini is labeled experimental unless it has a reliable session-end path.
- [ ] Team/public/Superpowers/action-intent features are documented as available but not the core v1 promise.

## Safety

- [ ] Captured items default to `visibility: private`.
- [ ] Public renderer only reads `public_summary` from `visibility: public` items.
- [ ] Public shipping requires `--approve`.
- [ ] Action intents require `--approve` before applying.
- [ ] Generated maps and Markdown source are documented as private-by-default.

## Durability

- [ ] Session capture writes Markdown source under `chronicle/`.
- [ ] Superpowers import, action intents, and release markers write Markdown source before syncing the JSON cache.
- [ ] Atomic writes and `.bak` backups are covered by tests.
- [ ] Generated index cleanup only removes files with the Chronicle marker.

## Quality Gates

Run these locally before tagging:

```bash
node --check $(find src tests -name '*.js' -print)
npm test
npm run validate
npm run smoke:v1
npm run render:brain
npm run render:indexes
npm pack --dry-run
```

Also run plugin validation when available:

```bash
python /Users/karmendrachoudhary/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

## Real Repo Gate

Before calling v1 complete, test Chronicle on three representative repositories. The automated smoke test covers this with throwaway git repos:

```bash
npm run smoke:v1
```

For a final human release review, also test on real user-facing repositories when available:

- [ ] A small Node/CLI repo.
- [ ] A frontend app repo.
- [ ] A repo that uses both Claude Code and Codex sessions.

For each repo, confirm a person unfamiliar with the code can open `dist/project-brain.html` and explain:

- what the project does;
- where important code lives;
- what changed recently;
- what appears stale or needs review.
