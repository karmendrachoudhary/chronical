---
name: team-report
description: Rebuild the Chronicle team-safe report from non-private items.
---

Run:

```bash
chronicle render team --store data/chronicle.json --output dist/team-report.html
```

Remind the user that private items are skipped and raw summaries are never rendered in the team report.
