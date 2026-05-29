# Chronicle Unified Item Schema

Chronicle now stores one local data file at `data/chronicle.json`. The important change is that the store is no longer only a list of events. It is a unified list of `items`.

Plain English: Chronicle captures work once, then renders many views from the same item list. A timeline entry, feature, file note, decision, roadmap task, release, or future action intent all use the same basic shape.

The top-level shape is:

```json
{
  "schema_version": 2,
  "generated_by": "chronicle-devlog@0.5.0",
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

For public rendering, Chronicle also filters tech tags through the same safety scanner before displaying them.

## Release Items

`chronicle public ship --approve` records a release item after writing the public HTML. Release items use the same shared fields and set:

```json
{
  "kind": "release",
  "visibility": "public",
  "public_summary": "Published v0.1.0 build update.",
  "data": {
    "version": "v0.1.0",
    "public_release": true,
    "output_path": "dist/public/index.html",
    "shipped_at": "2026-05-29T00:00:00.000Z",
    "item_ids": ["evt_1234abcd"]
  }
}
```

Plain English: the release item is Chronicle's bookmark. It tells the next public draft which public items were already shipped.

## Superpowers Import Items

`chronicle import superpowers` reads Markdown artifacts from:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`

Specs become private `feature` items, and decision bullets inside decision/tradeoff/architecture sections become private `decision` items. Plan tasks become private `roadmap` items. If every checkbox in a plan task is checked, Chronicle also creates a completed `feature` and a completed timeline `event` for that task.

Imported items set `data.artifact_type`, for example:

```json
{
  "data": {
    "artifact_type": "superpowers_plan_task",
    "plan_path": "docs/superpowers/plans/auth.md",
    "checkbox_total": 4,
    "checkbox_done": 4
  }
}
```

Plain English: Chronicle does not run Superpowers. It reads the files Superpowers already creates and turns them into the same item model as captured session work.

## Action Intent Files

The project-brain page exports action intents to `chronicle-actions.json`. This file is separate from `data/chronicle.json` because the static browser page must not edit project files directly.

Shape:

```json
{
  "schema_version": 1,
  "generated_by": "chronicle-project-brain",
  "intents": [
    {
      "action": "set_feature_status",
      "target": "feat_auth",
      "value": "completed",
      "created_at": "2026-05-29T00:00:00.000Z"
    }
  ]
}
```

Supported actions are `set_feature_status` and `set_roadmap_status`. The CLI applies them with:

```bash
node ./bin/chronicle.js actions apply --actions chronicle-actions.json --render
```

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
