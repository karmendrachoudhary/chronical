export function buildProjectBrainViewModel(items, { projectName = "Chronicle" } = {}) {
  const normalized = items.map((item) => ({ ...item, links: item.links ?? {} }));
  const events = normalized.filter((item) => item.kind === "event").sort(byDateDesc);
  const decisions = normalized.filter((item) => item.kind === "decision").sort(byDateDesc);
  const roadmap = normalized.filter((item) => item.kind === "roadmap").sort(byDateAsc);
  const explicitFeatures = normalized.filter((item) => item.kind === "feature").sort(byDateDesc);
  const explicitFiles = normalized.filter((item) => item.kind === "file").sort(byTitle);

  const features = explicitFeatures.length > 0 ? explicitFeatures : deriveFeatures(events);
  const files = explicitFiles.length > 0 ? explicitFiles : deriveFiles(events, features);
  linkEventsToDerivedItems(events, features, files);

  const tech = countTags(normalized.flatMap((item) => item.tech ?? []));
  const lastUpdated = normalized.map((item) => item.updated_at ?? item.created_at).sort().at(-1) ?? new Date().toISOString();
  const search = buildSearchIndex({ features, files, events, decisions, roadmap });

  return {
    projectName,
    generatedAt: new Date().toISOString(),
    lastUpdated,
    stats: {
      items: normalized.length,
      events: events.length,
      features: features.length,
      files: files.length,
      decisions: decisions.length,
      roadmap: roadmap.length,
      shipped: features.filter((item) => item.status === "completed").length,
      inProgress: features.filter((item) => item.status === "in_progress").length,
    },
    features,
    files,
    events,
    decisions,
    roadmap,
    tech,
    search,
  };
}

function deriveFeatures(events) {
  return events
    .filter((event) => ["feature_added", "bugfix", "refactor", "dependency_changed", "version_bump"].includes(event.type))
    .map((event) => ({
      id: `feat_${event.id.replace(/^evt_/, "")}`,
      kind: "feature",
      title: event.title,
      summary: event.summary || event.raw_summary,
      raw_summary: event.raw_summary,
      public_summary: event.public_summary,
      date: event.date,
      tech: event.tech,
      tags: [event.type],
      files_touched: event.files_touched,
      visibility: event.visibility,
      confidence: event.confidence,
      status: event.status === "completed" ? "completed" : event.status,
      source_ref: event.source_ref,
      files: event.files,
      links: { ...(event.links ?? {}), events: [event.id] },
      data: { derived_from_event: event.id },
      safety_flags: event.safety_flags,
      created_at: event.created_at,
      updated_at: event.updated_at,
    }));
}

function deriveFiles(events, features) {
  const byPath = new Map();
  for (const event of events) {
    for (const filePath of event.files ?? []) {
      const current = byPath.get(filePath) ?? {
        id: fileId(filePath),
        kind: "file",
        title: filePath,
        summary: "Touched during captured coding sessions.",
        raw_summary: "",
        public_summary: "",
        date: event.date,
        tech: [],
        tags: [],
        files_touched: 1,
        visibility: "private",
        confidence: "medium",
        status: "unknown",
        source_ref: {},
        files: [filePath],
        links: { features: [], files: [], decisions: [], roadmap: [], events: [], releases: [] },
        data: { path: filePath, role: "Touched during captured coding sessions." },
        safety_flags: [],
        created_at: event.created_at,
        updated_at: event.updated_at,
      };
      current.date = event.date > current.date ? event.date : current.date;
      current.updated_at = event.updated_at > current.updated_at ? event.updated_at : current.updated_at;
      current.tech = Array.from(new Set([...current.tech, ...(event.tech ?? [])]));
      current.links.events = Array.from(new Set([...current.links.events, event.id]));
      byPath.set(filePath, current);
    }
  }

  for (const feature of features) {
    for (const filePath of feature.files ?? []) {
      const file = byPath.get(filePath);
      if (file) {
        file.links.features = Array.from(new Set([...file.links.features, feature.id]));
      }
    }
  }

  return Array.from(byPath.values()).sort(byTitle);
}

function linkEventsToDerivedItems(events, features, files) {
  const featureIds = new Set(features.map((item) => item.id));
  const featureByEvent = new Map(features
    .filter((item) => item.data?.derived_from_event)
    .map((item) => [item.data.derived_from_event, item.id]));
  const fileIdsByPath = new Map(files.map((item) => [item.data?.path ?? item.title, item.id]));

  for (const event of events) {
    event.links = event.links ?? {};
    const derivedFeatureId = featureByEvent.get(event.id);
    event.links.features = Array.from(new Set([
      ...(event.links.features ?? []).filter((id) => featureIds.has(id)),
      ...(derivedFeatureId ? [derivedFeatureId] : []),
    ]));
    event.links.files = (event.files ?? [])
      .map((filePath) => fileIdsByPath.get(filePath) ?? fileId(filePath))
      .filter(Boolean);
  }
}

function buildSearchIndex({ features, files, events, decisions, roadmap }) {
  const rows = [
    ...features.map((item) => searchRow(item, "features", "FT")),
    ...files.map((item) => searchRow(item, "files", "FL")),
    ...events.map((item) => searchRow(item, "events", "LOG")),
    ...decisions.map((item) => searchRow(item, "decisions", "DEC")),
    ...roadmap.map((item) => searchRow(item, "roadmap", "PLN")),
  ];
  return rows;
}

function searchRow(item, tab, token) {
  const text = [item.title, item.summary, item.raw_summary, item.status, item.type, item.tech?.join(" "), item.tags?.join(" "), item.files?.join(" ")].join(" ");
  return {
    id: item.id,
    tab,
    token,
    title: item.title,
    subtitle: subtitleFor(item),
    haystack: text.toLowerCase(),
  };
}

function subtitleFor(item) {
  if (item.kind === "file") {
    return item.data?.role ?? item.summary;
  }
  return [item.status, item.date, item.tech?.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
}

function countTags(tags) {
  const counts = new Map();
  for (const tag of tags.filter(Boolean)) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function fileId(filePath) {
  return `file_${filePath.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown"}`;
}

function byDateDesc(a, b) {
  return String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at));
}

function byDateAsc(a, b) {
  return String(a.date).localeCompare(String(b.date)) || String(a.created_at).localeCompare(String(b.created_at));
}

function byTitle(a, b) {
  return String(a.title).localeCompare(String(b.title));
}
