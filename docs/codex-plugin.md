# Codex Plugin Install

Chronicle v2 ships as a Codex plugin as well as a normal Node CLI.

Plain English: the CLI still does the real work. The Codex plugin packages the Chronicle skill and a trusted `Stop` hook so Codex can refresh the project brain after completed turns.

## What The Plugin Adds

- `.codex-plugin/plugin.json` describes Chronicle to Codex.
- `skills/**/SKILL.md` gives Codex task-specific Chronicle instructions.
- `hooks/hooks.json` captures completed Codex turns with the `Stop` hook.
- `.agents/plugins/marketplace.json` lets Codex discover Chronicle from this repo as a local marketplace.

## Install From This Repo In Codex

Start Codex in this repository, then open:

```text
/plugins
```

Choose the `Chronicle Local` marketplace, install or enable `chronicle`, then open:

```text
/hooks
```

Review and trust the Chronicle `Stop` hook. Codex does not run plugin-bundled command hooks until you trust the exact hook definition.

If Codex does not show the repo marketplace automatically, add it from the terminal:

```bash
codex plugin marketplace add /Users/karmendrachoudhary/Desktop/SideProjects/Chronical
```

Restart Codex, then repeat `/plugins` and `/hooks`.

## Codex Slash Flow

Codex currently exposes plugin use through built-in slash commands, not plugin-defined custom slash commands.

Use:

```text
/plugins
/skills
/hooks
```

Then ask Codex in normal language:

```text
Use Chronicle to render my project brain.
Use Chronicle to render my team report.
Use Chronicle to draft the public build log for v0.1.0, but do not ship it.
Use Chronicle to validate the data store and public-safety rules.
Use Chronicle to apply reviewed action intents.
```

## Direct CLI Commands

These commands work in Codex after the package is linked or installed:

```bash
chronicle render brain --store data/chronicle.json --output dist/project-brain.html --index _INDEX.md
chronicle render team --store data/chronicle.json --output dist/team-report.html
chronicle public draft --version v0.1.0 --store data/chronicle.json --output dist/public-draft.html
chronicle validate --store data/chronicle.json
```

The plugin hook uses:

```bash
node "${PLUGIN_ROOT}/bin/chronicle.js" capture --hook-input - --source-tool codex --render --hook-mode
```

## Safety Defaults

- Public output remains allowlist-only.
- The public renderer reads only `public_summary` from `visibility: public` items.
- The hook exits safely and does not block Codex if Chronicle capture fails.
- Changing `hooks/hooks.json` requires another `/hooks` trust review.

## Update Rule

Codex caches installed plugins. After changing plugin files during local development, refresh or reinstall the local marketplace entry and restart Codex so it loads the new copy.
