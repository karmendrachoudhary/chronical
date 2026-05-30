# Claude Code Plugin Install

Chronicle v2 ships as a Claude Code plugin as well as a normal Node CLI.

Plain English: the CLI still does the real work. The plugin adds Claude Code-native hooks and slash commands that call the same CLI.

## What The Plugin Adds

- `.claude-plugin/plugin.json` describes Chronicle to Claude Code.
- `hooks/claude-plugin/hooks.json` captures completed Claude Code turns with the `Stop` hook.
- `skills/**/SKILL.md` creates namespaced slash commands such as `/chronicle:render-brain`.
- `.claude-plugin/marketplace.json` lets you install this repo as a local marketplace while developing.

## Fast Local Test

From this repository's parent directory, run:

```bash
claude --plugin-dir /Users/karmendrachoudhary/Desktop/SideProjects/Chronical
```

Then use the commands inside Claude Code:

```text
/chronicle:render-brain
/chronicle:team-report
/chronicle:public-draft v0.1.0
/chronicle:validate
```

The automatic `Stop` hook captures at the end of Claude Code turns after the plugin is loaded.

## Install From The Local Marketplace

Inside Claude Code, run:

```text
/plugin marketplace add /Users/karmendrachoudhary/Desktop/SideProjects/Chronical
/plugin install chronicle@chronicle-local
/reload-plugins
```

Then verify:

```text
/plugin
/chronicle:render-brain
```

## Claude Slash Commands

Claude Code plugin skills are namespaced by plugin name. Chronicle exposes:

| Slash command | Purpose |
| --- | --- |
| `/chronicle:capture` | Manually record a short summary for the current session. Automatic hooks are preferred for exact metadata. |
| `/chronicle:render-brain` | Rebuild `dist/project-brain.html` and generated indexes. |
| `/chronicle:team-report` | Rebuild `dist/team-report.html` from team-visible items. |
| `/chronicle:public-draft <version>` | Draft the public build log for review. Does not publish. |
| `/chronicle:public-ship <version>` | Ship only after explicit approval. |
| `/chronicle:apply-actions` | Apply reviewed `chronicle-actions.json` with `--approve`. |
| `/chronicle:import-superpowers` | Import Superpowers specs/plans read-only. |
| `/chronicle:validate` | Validate schema and public-safety rules. |

## Safety Defaults

- Public output remains allowlist-only.
- The public renderer reads only `public_summary` from `visibility: public` items.
- Browser action intents require human approval before `chronicle actions apply --approve` runs.
- The plugin hook is fail-safe: Chronicle reports a warning but does not block the coding session if capture fails.

## Update Rule

Claude Code caches plugins by version. Because Chronicle sets `version: "2.0.0"`, bump `.claude-plugin/plugin.json` whenever users should receive a plugin update.
