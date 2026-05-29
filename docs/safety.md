# Chronicle Safety Rules

Chronicle treats public publishing as allowlist-only.

The current build can draft and ship a public build log, but publishing is approval-gated:

- New items default to `visibility: private`.
- Secret-looking values in `raw_summary` force the item to stay private.
- Secret-looking values, local paths, internal URLs, and env var names in `title`, `summary`, or `public_summary` make a public item invalid.
- The validator rejects hand-edited public items that contain unsafe publishable text.
- The team report skips `private` items and never renders `raw_summary` or file-path lists.
- The public page only reads `visibility: public` items and only renders `public_summary`, safe dates, safe type labels, and safe tech tags.
- `chronicle public ship` refuses to run unless you pass `--approve`.
- `--dry-run` writes the public HTML for review but does not record a release marker or push GitHub Pages.

## What Chronicle Scans For

- OpenAI, Anthropic, GitHub, AWS, Stripe, npm, Slack, and JWT-looking tokens.
- Private key blocks.
- Generic assignments like `API_KEY=...`, `token: ...`, or `password=...`.
- Local paths such as `/Users/name/project/file.ts`.
- Internal URLs such as `localhost`, `127.0.0.1`, private network IPs, `.local`, `.internal`, and `.test` hosts.
- Environment variable names that look sensitive.

## Important Boundary

`raw_summary` is private and may include local file paths. Public renderers must never render it. They must only render `public_summary` from items already marked `visibility: public`.

The project-brain page and `_INDEX.md` are private-by-default local artifacts. They can show file paths and project structure, so Chronicle should not publish them automatically.

The team report is shareable with collaborators, but it is not a public page. It only shows items explicitly marked `team` or `public`. Public items still use `public_summary` only.

## Public Ship Flow

1. Draft: `node ./bin/chronicle.js public draft --version v0.1.0`
2. Review the generated `dist/public-draft.html` file.
3. Ship locally: `node ./bin/chronicle.js public ship --version v0.1.0 --approve`
4. Optional GitHub Pages publish: add `--github-pages` after reviewing the draft.

Chronicle records a `kind: "release"` item only on a real approved ship. That release item stores the version and the ids of the public items that were included, so the next draft starts after the last release.
