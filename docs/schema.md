# Chronicle Unified Item Schema

Chronicle now stores one local data file at `data/chronicle.json`. The important change is that the store is no longer only a list of events. It is a unified list of `items`.

Plain English: Chronicle captures work once, then renders many views from the same item list. A timeline entry, feature, file note, decision, roadmap task, release, or future action intent all use the same basic shape.

The top-level shape is:

```json
{
  "schema_version": 2,
  "generated_by": "chronicle-devlog@0.2.0",
  "items": []
}
```

The machine-readable schema is `schemas/item.schema.json`. The old `schemas/event.schema.json` is legacy reference only.

## Item Kinds

- `event`: something that happened in an AI coding session.
- `feature`: a user-visible capability or major internal capability.
- `file`: a known important file or folder and what it does.
- `decision`: why a choice was made.
- `roadmap`: planned, current, or future work.
- `release`: a deploy, tag, or version moment.
- `action_intent`: a safe browser-recorded request for the agent to apply later.

## Shared Fields

- `id`: stable id like `evt_1234abcd`, `feat_auth`, or `plan_search`.
- `kind`: one of the item kinds above.
- `title`: short label for cards and search results.
- `summary`: private description used by the project-brain page.
- `raw_summary`: private detailed capture notes. This may include file paths.
- `public_summary`: safe publishable line. Public views and public items inside team reports may read this only for `visibility: public` items.
- `date`: local calendar date.
- `tech`: technology tags like `Node.js` or `Auth.js`.
- `tags`: lightweight labels for filtering/search.
- `files`: file paths touched or related to the item.
- `links`: cross-links to related items, grouped by kind.
- `visibility`: `private`, `team`, or `public`.
- `status`: `completed`, `blocked`, `in_progress`, `planned`, `idea`, or `unknown`.
- `safety_flags`: scanner results like `raw_summary:openai_key`.

## Event Fields

For `kind: "event"`, Chronicle also requires:

- `type`: `feature_added`, `bugfix`, `refactor`, `dependency_changed`, `version_bump`, `decision`, or `note`.
- `session_id`: the coding-tool session id, or `manual` when captured manually.
- `source_tool`: `claude-code`, `codex`, or `gemini`.
- `source_ref`: transcript path, cwd, turn id, and hook event name when available.

## Safety Rule

The default visibility is always `private`. Public renderers must only read items with `visibility: public`, and must use `public_summary`, not `raw_summary` or `summary`.

Team renderers must only read items with `visibility: team` or `visibility: public`. For team items, they may read `summary`. For public items, they must still read `public_summary` only.

Chronicle validates public items strictly. A public item is invalid if `title`, `summary`, or `public_summary` contains secret-looking values, local paths, internal URLs, or sensitive env var names.

Use this command after hand-editing the store:

```bash
node ./bin/chronicle.js validate --store data/chronicle.json
```

## Compatibility

Chronicle can still read old `events[]` stores. When loaded, each old event becomes a `kind: "event"` item in memory. New writes use `items[]` and `schema_version: 2`.

## Optional Summarizer Command

By default Chronicle uses an offline summarizer. You can configure `chronicle.config.json` with `capture.summarizerCommand` if you want a local LLM or custom script.

The command receives JSON on stdin:

```json
{
  "parsed": {},
  "hookInput": {},
  "sourceTool": "claude-code"
}
```

It should return JSON on stdout:

```json
{
  "title": "Added passwordless login",
  "raw_summary": "Private detailed notes",
  "public_summary": "Added passwordless login.",
  "type": "feature_added",
  "status": "completed",
  "tech": ["Auth.js"]
}
```

If the command fails or times out, Chronicle falls back to the offline summarizer.
