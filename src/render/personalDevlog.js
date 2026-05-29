import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEventStore } from "../store/eventsStore.js";
import { escapeHtml } from "../utils/html.js";

const TYPE_LABELS = {
  feature_added: "Feature",
  bugfix: "Bugfix",
  refactor: "Refactor",
  dependency_changed: "Dependency",
  version_bump: "Version",
  decision: "Decision",
  note: "Note",
};

export async function renderPersonalDevlogToFile({ storePath, outputPath }) {
  const store = await loadEventStore(storePath);
  const html = renderPersonalDevlog(store.events, { storePath });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
  return { outputPath, eventCount: store.events.length };
}

export function renderPersonalDevlog(events, { storePath = "data/chronicle.json" } = {}) {
  const sorted = [...events].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const stats = buildStats(sorted);
  const grouped = groupByDate(sorted);
  const tech = buildTechStats(sorted);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chronicle Personal Devlog</title>
  <style>${CSS}</style>
</head>
<body>
  <main class="shell">
    <section class="hero" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">Personal devlog</p>
        <h1 id="page-title">Chronicle</h1>
        <p class="lede">A private record of what actually changed during AI coding sessions.</p>
      </div>
      <dl class="stats" aria-label="Devlog stats">
        ${statItem("Events", stats.events)}
        ${statItem("Sessions", stats.sessions)}
        ${statItem("Files", stats.files)}
        ${statItem("Tools", stats.tools)}
      </dl>
    </section>

    <section class="privacy-band">
      <div>
        <strong>Private view.</strong> This page can show raw summaries and local file paths from ${escapeHtml(storePath)}.
      </div>
      <span>Last updated ${escapeHtml(new Date().toLocaleString())}</span>
    </section>

    <section class="section-grid" aria-label="Devlog overview">
      <div class="panel">
        <h2>Work Timeline</h2>
        ${renderTimeline(grouped)}
      </div>
      <div class="panel">
        <h2>Tech Stack Over Time</h2>
        ${renderTechStack(tech)}
      </div>
    </section>

    <section class="panel event-panel" aria-labelledby="event-heading">
      <div class="section-heading">
        <h2 id="event-heading">Session Events</h2>
        <span>${sorted.length} total</span>
      </div>
      ${renderEvents(sorted)}
    </section>
  </main>
</body>
</html>`;
}

function buildStats(events) {
  return {
    events: events.length,
    sessions: new Set(events.map((event) => event.session_id)).size,
    files: events.reduce((total, event) => total + Number(event.files_touched ?? 0), 0),
    tools: new Set(events.map((event) => event.source_tool)).size,
  };
}

function buildTechStats(events) {
  const counts = new Map();
  for (const event of events) {
    for (const tech of event.tech ?? []) {
      counts.set(tech, (counts.get(tech) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function groupByDate(events) {
  const groups = new Map();
  for (const event of events) {
    const date = event.date ?? "Undated";
    groups.set(date, [...(groups.get(date) ?? []), event]);
  }
  return [...groups.entries()];
}

function statItem(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function renderTimeline(groups) {
  if (groups.length === 0) {
    return `<p class="empty">No events captured yet.</p>`;
  }
  return `<ol class="timeline">${groups.map(([date, events]) => `
    <li>
      <time>${escapeHtml(date)}</time>
      <div>${events.map((event) => `<span class="type-chip">${escapeHtml(TYPE_LABELS[event.type] ?? event.type)}</span>`).join("")}</div>
      <p>${events.length} event${events.length === 1 ? "" : "s"}</p>
    </li>`).join("")}</ol>`;
}

function renderTechStack(tech) {
  if (tech.length === 0) {
    return `<p class="empty">Tech tags will appear after Chronicle sees files or summaries it recognizes.</p>`;
  }
  const max = Math.max(...tech.map(([, count]) => count));
  return `<div class="tech-list">${tech.map(([label, count]) => `
    <div class="tech-row">
      <span>${escapeHtml(label)}</span>
      <div class="bar" aria-hidden="true"><i style="width:${Math.max(16, (count / max) * 100)}%"></i></div>
      <strong>${count}</strong>
    </div>`).join("")}</div>`;
}

function renderEvents(events) {
  if (events.length === 0) {
    return `<div class="empty-state"><h3>Nothing captured yet</h3><p>Run <code>npm run capture:sample</code> or connect a hook to start the devlog.</p></div>`;
  }

  return `<div class="event-grid">${events.map(renderEventCard).join("")}</div>`;
}

function renderEventCard(event) {
  const flags = event.safety_flags?.length ? `<p class="flags">Safety flags: ${event.safety_flags.map(escapeHtml).join(", ")}</p>` : "";
  const files = event.files?.length ? `<details><summary>${event.files.length} file path${event.files.length === 1 ? "" : "s"}</summary><ul>${event.files.map((file) => `<li><code>${escapeHtml(file)}</code></li>`).join("")}</ul></details>` : "";
  const tech = event.tech?.length ? `<div class="chips">${event.tech.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : "";

  return `<article class="event-card">
    <div class="card-topline">
      <span class="type-chip">${escapeHtml(TYPE_LABELS[event.type] ?? event.type)}</span>
      <span>${escapeHtml(event.status ?? "unknown")} · ${escapeHtml(event.source_tool)}</span>
    </div>
    <h3>${escapeHtml(event.title || headlineFromSummary(event.raw_summary))}</h3>
    <pre>${escapeHtml(event.raw_summary)}</pre>
    ${tech}
    ${files}
    ${flags}
    <footer>
      <span>${escapeHtml(event.date)}</span>
      <span>${escapeHtml(event.confidence ?? "low")} confidence</span>
      <span>${escapeHtml(event.visibility)}</span>
    </footer>
  </article>`;
}

function headlineFromSummary(summary) {
  const outcomeLine = summary.split("\n").find((line) => line.startsWith("Outcome:"));
  const goalLine = summary.split("\n").find((line) => line.startsWith("Goal:"));
  return (outcomeLine ?? goalLine ?? summary).replace(/^(Outcome|Goal):\s*/, "").slice(0, 96);
}

const CSS = `
:root {
  color-scheme: light;
  --ink: #172026;
  --muted: #61707a;
  --line: #d8e0e4;
  --surface: #ffffff;
  --wash: #f5f7f4;
  --accent: #116a6c;
  --accent-2: #b4552c;
  --accent-3: #6e4a8f;
  --shadow: 0 18px 55px rgba(23, 32, 38, 0.08);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--wash);
  color: var(--ink);
  line-height: 1.5;
}
.shell { width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
.hero { display: grid; grid-template-columns: 1fr minmax(280px, 460px); gap: 24px; align-items: end; padding: 40px 0 28px; }
.eyebrow { margin: 0 0 8px; color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: 0.78rem; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 12px; font-size: clamp(3rem, 8vw, 6.4rem); line-height: 0.92; letter-spacing: 0; }
h2 { margin-bottom: 18px; font-size: 1.25rem; }
h3 { font-size: 1rem; line-height: 1.35; margin-bottom: 12px; }
.lede { max-width: 660px; color: var(--muted); font-size: 1.08rem; }
.stats { margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.stats div, .panel, .event-card, .privacy-band { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.stats div { padding: 16px; }
.stats dt { color: var(--muted); font-size: 0.82rem; }
.stats dd { margin: 4px 0 0; font-size: 1.8rem; font-weight: 800; }
.privacy-band { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; color: var(--muted); box-shadow: var(--shadow); }
.privacy-band strong { color: var(--ink); }
.section-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 18px; margin-top: 18px; }
.panel { padding: 22px; box-shadow: var(--shadow); }
.timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
.timeline li { display: grid; grid-template-columns: 112px 1fr auto; gap: 12px; align-items: center; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.timeline li:last-child { border-bottom: 0; padding-bottom: 0; }
.timeline time { font-weight: 800; }
.timeline p { margin: 0; color: var(--muted); }
.type-chip { display: inline-flex; align-items: center; min-height: 26px; margin: 2px 6px 2px 0; padding: 3px 9px; border: 1px solid rgba(17, 106, 108, 0.22); border-radius: 999px; color: var(--accent); background: #edf7f5; font-weight: 700; font-size: 0.78rem; }
.tech-list { display: grid; gap: 12px; }
.tech-row { display: grid; grid-template-columns: 92px 1fr 24px; gap: 10px; align-items: center; }
.bar { height: 10px; background: #ecedef; border-radius: 999px; overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
.section-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.section-heading span { color: var(--muted); }
.event-panel { margin-top: 18px; }
.event-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.event-card { padding: 18px; }
.card-topline, .event-card footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; color: var(--muted); font-size: 0.83rem; }
.event-card pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 14px; font: inherit; color: #2d3940; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0; }
.chips span { padding: 4px 8px; border-radius: 999px; background: #f2edf7; color: var(--accent-3); font-size: 0.78rem; font-weight: 700; }
details { margin: 12px 0; }
summary { cursor: pointer; font-weight: 700; color: var(--accent); }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
ul { padding-left: 20px; }
.flags { margin: 10px 0; color: #8a3c1f; font-weight: 700; }
.empty, .empty-state { color: var(--muted); }
.empty-state { padding: 24px; border: 1px dashed var(--line); border-radius: 8px; }
@media (max-width: 820px) {
  .shell { width: min(100% - 24px, 680px); padding-top: 18px; }
  .hero, .section-grid, .event-grid { grid-template-columns: 1fr; }
  .privacy-band, .timeline li, .card-topline, .event-card footer { align-items: flex-start; flex-direction: column; }
  .timeline li { grid-template-columns: 1fr; }
}
`;
