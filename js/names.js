const ORIG_NAMES = { ninja: {}, scroll: {}, summon: {} };
const FIX_LISTS = { ninja: NINJAS, scroll: SCROLLS, summon: SUMMONS };
const FIX_KEY = "bp-name-fixes";

function snapshotOrigNames() {
  Object.keys(FIX_LISTS).forEach((k) => {
    FIX_LISTS[k].forEach((n) => {
      ORIG_NAMES[k][n.id] = { name: n.name, title: n.title || "" };
    });
  });
}

function loadNameFixes() {
  try {
    return JSON.parse(localStorage.getItem(FIX_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function saveNameFixes(fixes) {
  localStorage.setItem(FIX_KEY, JSON.stringify(fixes));
}

function prefixOf(kind, name, prev) {
  if (kind === "scroll") {
    const i = name.indexOf("·");
    return i > 0 ? name.slice(0, i) : "";
  }
  if (kind === "summon") {
    const m = name.match(/「([^」]+)」/);
    return m ? m[1] : "";
  }
  return prev || "";
}

function applyEntry(kind, n, entry) {
  if (entry == null) return;
  if (typeof entry === "string") {
    n.name = entry;
    n.title = prefixOf(kind, entry, n.title || "");
    return;
  }
  if (entry.name) n.name = entry.name;
  n.title = entry.title != null ? entry.title : prefixOf(kind, n.name, n.title || "");
}

function applyNameFixes() {
  const f = loadNameFixes();
  Object.keys(FIX_LISTS).forEach((k) => {
    const o = f[k] || {};
    FIX_LISTS[k].forEach((n) => applyEntry(k, n, o[n.id]));
  });
}

function setItemName(kind, id, name) {
  const item = FIX_LISTS[kind].find((x) => x.id === id);
  if (!item) return;
  const orig = ORIG_NAMES[kind][id];
  const v = name.trim() || orig.name;
  item.name = v;
  item.title = prefixOf(kind, v, orig.title);
  const f = loadNameFixes();
  if (!f[kind]) f[kind] = {};
  if (v === orig.name && item.title === orig.title) delete f[kind][id];
  else f[kind][id] = { name: item.name, title: item.title };
  saveNameFixes(f);
  return item;
}

function resetFixTab(kind) {
  FIX_LISTS[kind].forEach((n) => {
    const orig = ORIG_NAMES[kind][n.id];
    n.name = orig.name;
    n.title = orig.title;
  });
  const f = loadNameFixes();
  f[kind] = {};
  saveNameFixes(f);
}
