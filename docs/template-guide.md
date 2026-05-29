# Contributing a New View Template

Chronicle follows one rule: capture once, render many.

Plain English: do not add a second data store for a new page. Add a renderer that reads the existing `items` list from the generated cache after Markdown source has synced.

## Where Renderers Live

Current renderers are in `src/render/`:

- `personalDevlog.js` renders the simple private devlog.
- `projectBrain.js` renders the full private project brain.
- `teamReport.js` renders the filtered team report.
- `publicBuildPage.js` renders the public build log.
- `projectIndex.js` renders generated `_INDEX.md` map files.

Add new templates in the same folder. Use a small exported function for the HTML string and, if needed, a second function that writes it to disk.

## Renderer Rules

1. Read from `items`, not from raw transcripts.
2. Keep output self-contained: inline CSS and JavaScript, no external CDN files.
3. Escape every value before putting it into HTML.
4. Preserve safety boundaries:
   - Private views may show `summary`, `raw_summary`, and file paths.
   - Team views must skip `private` items and must never show `raw_summary`.
   - Public views must only read `visibility: public` items and must only render `public_summary`.
5. Add tests that prove unsafe fields do not leak.

## Minimal Renderer Shape

```js
import { loadChronicleStore } from "../store/eventsStore.js";
import { escapeHtml, writeHtmlFile } from "../utils/html.js";

export function renderMyView(items) {
  const visibleItems = items.filter((item) => item.visibility !== "private");
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>My Chronicle View</title></head>
  <body>${visibleItems.map((item) => `<p>${escapeHtml(item.title)}</p>`).join("")}</body>
</html>`;
}

export async function renderMyViewToFile({ storePath, outputPath }) {
  const store = await loadChronicleStore(storePath);
  await writeHtmlFile(outputPath, renderMyView(store.items));
  return { outputPath, itemCount: store.items.length };
}
```

## CLI Wiring Checklist

- Add the renderer import in `src/cli.js`.
- Add a command under `chronicle render <name>`.
- Add an npm script in `package.json` if the command is common.
- Document the command in `README.md`.
- Add a test in `tests/chronicle.test.js`.

## Public Safety Checklist

Before opening a pull request for a public or team view, include a test that fails if the output contains any of these:

- `raw_summary`
- a private-only marker from a fixture
- local paths like `/Users/`
- internal URLs like `localhost`
- external runtime dependencies like `<script src=` or `<link`

The existing team and public tests are good examples to copy.
