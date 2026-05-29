# Chronicle Safety Rules

Chronicle treats public publishing as allowlist-only.

The current build does not publish anything yet, but the safety foundation is in place:

- New items default to `visibility: private`.
- Secret-looking values in `raw_summary` force the item to stay private.
- Secret-looking values, local paths, internal URLs, and env var names in `title`, `summary`, or `public_summary` make a public item invalid.
- The validator rejects hand-edited public items that contain unsafe publishable text.

## What Chronicle Scans For

- OpenAI, Anthropic, GitHub, AWS, Stripe, npm, Slack, and JWT-looking tokens.
- Private key blocks.
- Generic assignments like `API_KEY=...`, `token: ...`, or `password=...`.
- Local paths such as `/Users/name/project/file.ts`.
- Internal URLs such as `localhost`, `127.0.0.1`, private network IPs, `.local`, `.internal`, and `.test` hosts.
- Environment variable names that look sensitive.

## Important Boundary

`raw_summary` is private and may include local file paths. Public renderers in later phases must never read it. They must only read `public_summary` from items already marked `visibility: public`.

The project-brain page and `_INDEX.md` are private-by-default local artifacts. They can show file paths and project structure, so Chronicle should not publish them automatically.
