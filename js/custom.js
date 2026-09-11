const CUSTOM_KEY = "bp-custom-items";
const CUSTOM_IMG_KEY = "bp-custom-imgs";

function parseBracketName(raw) {
  const s = (raw || "").trim();
  const m = s.match(/^(.*?)[\s]*[「\[]([^」\]]+)[」\]]$/);
  if (m && m[1].trim()) return { main: m[1].trim(), suffix: m[2].trim() };
  return { main: s, suffix: "" };
}

function loadCustomStore() {
  try {
    return {
      items: JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"),
      imgs: JSON.parse(localStorage.getItem(CUSTOM_IMG_KEY) || "{}")
    };
  } catch (e) {
    return { items: [], imgs: {} };
  }
}

function saveCustomStore(items, imgs) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(items));
  localStorage.setItem(CUSTOM_IMG_KEY, JSON.stringify(imgs));
}

function listOfKind(kind) {
  if (kind === "ninja") return NINJAS;
  if (kind === "scroll") return SCROLLS;
  return SUMMONS;
}

function buildCustomItem(kind, rawName) {
  const { main, suffix } = parseBracketName(rawName);
  const id = "c" + Date.now();
  if (kind === "ninja") {
    if (suffix) {
      return { id, name: suffix, title: main, rank: "A", tags: [], gender: "", alias: "", sort: 0, date: "", kind: "legend" };
    }
    return { id, name: main, title: "", rank: "A", tags: [], gender: "", alias: "", sort: 0, date: "", kind: "origin" };
  }
  if (kind === "scroll") {
    const name = suffix ? (main.includes("·") ? main : suffix + "·" + main) : main;
    const title = suffix || (name.includes("·") ? name.slice(0, name.indexOf("·")) : "");
    return { id, name, title, alias: main };
  }
  const name = suffix ? main + "「" + suffix + "」" : main;
  return { id, name, title: suffix, alias: main };
}

function injectCustom(item, kind, img) {
  const list = listOfKind(kind);
  if (list.some((x) => x.id === item.id)) return;
  list.unshift(item);
  if (img) CUSTOM_IMG[item.id] = img;
  if (ORIG_NAMES && ORIG_NAMES[kind]) ORIG_NAMES[kind][item.id] = { name: item.name, title: item.title || "" };
}

function loadCustomItems() {
  const store = loadCustomStore();
  Object.keys(store.imgs).forEach((id) => { CUSTOM_IMG[id] = store.imgs[id]; });
  store.items.forEach((row) => injectCustom(row.item, row.kind, store.imgs[row.item.id]));
}

function addCustomItem(kind, rawName, img) {
  const item = buildCustomItem(kind, rawName);
  const store = loadCustomStore();
  store.items.unshift({ kind, item });
  if (img) store.imgs[item.id] = img;
  saveCustomStore(store.items, store.imgs);
  injectCustom(item, kind, img);
  return item;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 200;
      const scale = Math.min(max / img.width, max / img.height, 1);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img"));
    };
    img.src = url;
  });
}
