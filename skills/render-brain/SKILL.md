---
name: render-brain
description: Rebuild the main Chronicle project-brain HTML page and generated repo indexes.
---

Run:

```bash
chronicle render brain --store data/chronicle.json --output dist/project-brain.html --index _INDEX.md
```

Then tell the user where the HTML file and root index were written. Plain English: this does not capture new work by itself; it regenerates the readable outputs from the existing Chronicle Markdown source.
