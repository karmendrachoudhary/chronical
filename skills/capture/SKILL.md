---
name: capture
description: Capture the current AI coding session into Chronicle source notes and refresh local outputs.
---

Run Chronicle capture for the current tool, then report the generated files.

When this runs from an automatic hook, the hook already passes JSON on stdin. Do not manually run `--hook-input -` from a normal slash command because it will wait for stdin.

For manual slash-command use, write one plain summary sentence from the current session and run the matching command:

```bash
chronicle capture --source-tool claude-code --summary "<what changed in this session>" --render
```

For Codex, use:

```bash
chronicle capture --source-tool codex --summary "<what changed in this session>" --render
```

Plain English: hooks capture exact session metadata automatically; manual slash use records the agent's concise summary.
