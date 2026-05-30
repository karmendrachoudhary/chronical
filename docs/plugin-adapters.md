# Plugin Adapter Strategy

Chronicle should not become a separate implementation for every agent tool.

The stable core is:

```text
bin/chronicle.js
src/**
chronicle/*.md
data/chronicle.json
dist/*.html
```

Every host integration should be thin:

| Host | v2 status | Adapter files | Invocation model |
| --- | --- | --- | --- |
| Claude Code | Supported plugin | `.claude-plugin/plugin.json`, `hooks/claude-plugin/hooks.json`, `skills/**` | `/chronicle:*` slash commands plus `Stop` hook |
| Codex | Supported plugin | `.codex-plugin/plugin.json`, `hooks/hooks.json`, `skills/**`, `.agents/plugins/marketplace.json` | `/plugins`, `/skills`, `/hooks`, plus `Stop` hook |
| Claude Code manual hook | Supported | `hooks/claude/hooks.json` | Merge into `.claude/settings.json` |
| Codex manual hook | Supported | `hooks/codex/hooks.json` | Copy to `.codex/hooks.json` |
| Gemini CLI | Experimental | `hooks/gemini/settings.json` | `AfterAgent` turn-level capture |
| OpenCode / Plod / Hermes hosts | Planned | Not implemented until their plugin specs are confirmed | Should call the same `chronicle` CLI |

Plain English: npm is the engine, plugins are wrappers. This keeps capture, rendering, safety checks, and schema validation in one place.

## Rule For Future Adapters

New adapters should only do three things:

1. Pass the host's hook JSON to `chronicle capture`.
2. Set the correct `--source-tool` value when Chronicle supports that host.
3. Expose simple commands or skills that call existing Chronicle CLI commands.

Do not duplicate renderers, parsers, public-safety logic, or Markdown source writing in host-specific adapters.
