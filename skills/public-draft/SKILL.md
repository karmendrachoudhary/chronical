---
name: public-draft
description: Draft the public Chronicle build log for review without publishing it.
---

Ask the user for a version if they did not provide one. Then run:

```bash
chronicle public draft --version <version> --store data/chronicle.json --output dist/public-draft.html
```

Do not run `public ship` from this skill. The public page is allowlist-only and needs a separate human approval step.
