---
name: public-ship
description: Ship an approved Chronicle public build log after the draft has been reviewed.
---

Use only after the user explicitly says the public draft is approved. Ask for a version if missing, then run:

```bash
chronicle public ship --version <version> --approve --store data/chronicle.json --output dist/public/index.html
```

For GitHub Pages, add `--github-pages` only when the user asks to publish to the `gh-pages` branch. Public shipping must never happen automatically after normal session capture.
