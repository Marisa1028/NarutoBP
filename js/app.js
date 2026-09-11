const SEQ = [
  ["first", "ban"], ["second", "ban"], ["second", "ban"], ["first", "ban"],
  ["first", "pick"], ["second", "pick"], ["second", "pick"],
  ["first", "pick"], ["first", "pick"], ["second", "pick"]
];

const state = {
  screen: "home",
  redName: "红方",
  blueName: "蓝方",
  firstPref: "random",
  first: "red",
  pubBans: [],
  pubSearch: "",
  bo: 3,
  round: 0,
  history: [],
  step: 0,
  selected: null,
  eqSide: null,
  red: { bans: [], picks: [], order: [], scrolls: [], summons: [] },
  blue: { bans: [], picks: [], order: [], scrolls: [], summons: [] },
  search: "",
  eqSearch: "",
  ranks: new Set(["S", "A", "B", "C"]),
  equipPhase: null,
  equipLog: [],
  scrollsRevealed: false,
  summonsRevealed: false,
  fixTab: "ninja",
  fixSearch: "",
  addKind: "ninja",
  addName: "",
  addImg: ""
};

function emptyTeam() {
  return { bans: [], picks: [], order: [], scrolls: [], summons: [] };
}

function $(sel, root) {
  return (root || document).querySelector(sel);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function isAdmin() {
  return /(?:^|[?&])admin=1(?:&|$)/.test(location.search);
}

function searchBox(placeholder, value, onInput) {
  const inp = el("input");
  inp.type = "text";
  inp.placeholder = placeholder;
  inp.value = value;
  inp.oninput = () => onInput(inp.value);
  return inp;
}

function rankFilters() {
  const filters = el("div", "filters");
  ["S", "A", "B", "C"].forEach((r) => {
    const b = el("button", "chip " + r + (state.ranks.has(r) ? " on" : ""), r);
    b.onclick = () => {
      if (state.ranks.has(r)) {
        if (state.ranks.size > 1) state.ranks.delete(r);
      } else state.ranks.add(r);
      render();
    };
    filters.appendChild(b);
  });
  return filters;
}

function ninjaCard(n, extra, stamp, onClick) {
  const card = el("div", "card" + (extra || ""));
  const img = el("img");
  img.width = 120;
  img.height = 112;
  img.src = IMG(n.id);
  img.alt = showName(n);
  const info = el("div", "info");
  info.appendChild(el("div", "title", showTitle(n)));
  info.appendChild(el("div", "name", showName(n)));
  card.appendChild(el("div", "rank " + n.rank, n.rank));
  if (n.kind === "legend") card.appendChild(el("div", "kind-legend", "传说"));
  card.appendChild(img);
  card.appendChild(info);
  if (stamp) card.appendChild(el("div", "stamp " + stamp.cls, stamp.text));
  card.onclick = onClick;
  return card;
}

function showName(n) {
  if (n.kind === "legend") return n.title || n.name;
  return n.name;
}

function showTitle(n) {
  if (n.kind === "legend") return n.name;
  return n.title || " ";
}

function displayName(n) {
  if (n.kind === "legend") return n.title ? "「" + n.name + "」" + n.title : n.name;
  return n.title ? "「" + n.title + "」" + n.name : n.name;
}

function findNinja(id) {
  return NINJAS.find((n) => n.id === id);
}

function findScroll(id) {
  return SCROLLS.find((x) => x.id === id);
}

function findSummon(id) {
  return SUMMONS.find((x) => x.id === id);
}

function matchesText(n, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return n.name.toLowerCase().includes(q) || (n.title || "").toLowerCase().includes(q) || (n.alias || "").toLowerCase().includes(q);
}

function sideOf(who) {
  if (who === "first") return state.first;
  return state.first === "red" ? "blue" : "red";
}

function current() {
  const s = SEQ[state.step];
  if (!s) return null;
  return { side: sideOf(s[0]), type: s[1] };
}

function consumedPicks() {
  const s = {};
  state.history.forEach((g, i) => {
    if (i >= state.round) return;
    g.red.picks.forEach((id) => { s[id] = 1; });
    g.blue.picks.forEach((id) => { s[id] = 1; });
  });
  return s;
}

function usedMap() {
  const m = {};
  state.pubBans.forEach((id) => { m[id] = "pub"; });
  Object.keys(consumedPicks()).forEach((id) => { m[id] = "used"; });
  ["red", "blue"].forEach((side) => {
    state[side].bans.forEach((id) => { m[id] = "ban"; });
    state[side].picks.forEach((id) => { m[id] = "pick"; });
  });
  return m;
}

function snapshot() {
  return {
    red: {
      bans: state.red.bans.slice(),
      picks: state.red.picks.slice(),
      order: state.red.order.slice(),
      scrolls: state.red.scrolls.slice(),
      summons: state.red.summons.slice()
    },
    blue: {
      bans: state.blue.bans.slice(),
      picks: state.blue.picks.slice(),
      order: state.blue.order.slice(),
      scrolls: state.blue.scrolls.slice(),
      summons: state.blue.summons.slice()
    },
    winner: null
  };
}

function equipKey() {
  return state.equipPhase === "scroll" ? "scrolls" : "summons";
}

function equipList() {
  return state.equipPhase === "scroll" ? SCROLLS : SUMMONS;
}

function currentEquip() {
  if (!state.equipPhase) return null;
  return { type: state.equipPhase };
}

function equipCount(side) {
  return state[side][equipKey()].length;
}

function consumedEquips(key, side) {
  const s = {};
  state.history.forEach((g, i) => {
    if (i >= state.round) return;
    (g[side][key] || []).forEach((id) => { s[id] = 1; });
  });
  return s;
}

function usedEquips(side) {
  const key = equipKey();
  const m = {};
  if (!side) return m;
  Object.keys(consumedEquips(key, side)).forEach((id) => { m[id] = "used"; });
  state[side][key].forEach((id) => { m[id] = "pick"; });
  return m;
}

function equipOf(side, ninjaId, key) {
  const i = state[side].picks.indexOf(ninjaId);
  return i >= 0 ? state[side][key][i] : null;
}

function neededWins() {
  return Math.floor(state.bo / 2) + 1;
}

function seriesScore() {
  let red = 0;
  let blue = 0;
  state.history.forEach((g) => {
    if (g.winner === "red") red += 1;
    if (g.winner === "blue") blue += 1;
  });
  return { red, blue };
}

function seriesOver() {
  const s = seriesScore();
  const n = neededWins();
  return s.red >= n || s.blue >= n;
}

function filtered(qStr) {
  const q = (qStr == null ? state.search : qStr).trim();
  return NINJAS.filter((n) => state.ranks.has(n.rank) && matchesText(n, q)).sort((a, b) => {
    const d = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    return d || (b.sort - a.sort);
  });
}

function confirmPick(id) {
  const cur = current();
  if (!cur || usedMap()[id]) return;
  state[cur.side][cur.type === "ban" ? "bans" : "picks"].push(id);
  state.selected = null;
  state.step += 1;
  if (state.step >= SEQ.length) {
    state.equipPhase = "scroll";
    state.equipLog = [];
    state.eqSide = null;
    state.scrollsRevealed = false;
    state.summonsRevealed = false;
    state.eqSearch = "";
    render();
    return;
  }
  render();
}

function confirmEquip(id, side) {
  side = side || state.eqSide;
  if (!state.equipPhase || !side || equipCount(side) >= 3 || usedEquips(side)[id]) return;
  const key = equipKey();
  state[side][key].push(id);
  state.equipLog.push({ side, key });
  state.selected = null;
  state.eqSide = null;
  if (equipCount("red") >= 3 && equipCount("blue") >= 3) {
    if (state.equipPhase === "scroll") {
      state.scrollsRevealed = true;
      state.equipPhase = "summon";
      state.eqSearch = "";
    } else {
      state.summonsRevealed = true;
      state.equipPhase = null;
      state.red.order = state.red.picks.slice();
      state.blue.order = state.blue.picks.slice();
      state.history[state.round] = snapshot();
      state.screen = "result";
    }
  }
  render();
}

function undo() {
  if (state.equipPhase && state.equipLog.length) {
    const last = state.equipLog.pop();
    state[last.side][last.key].pop();
    if (last.key === "scrolls") {
      state.equipPhase = "scroll";
      state.scrollsRevealed = false;
    } else {
      state.equipPhase = "summon";
      state.summonsRevealed = false;
    }
    state.selected = null;
    state.eqSide = null;
    render();
    return;
  }
  if (state.equipPhase === "scroll") {
    state.equipPhase = null;
    if (state.step <= 0) return;
    state.step -= 1;
    const cur = current();
    state[cur.side][cur.type === "ban" ? "bans" : "picks"].pop();
    state.selected = null;
    state.eqSide = null;
    render();
    return;
  }
  if (state.step <= 0) return;
  state.step -= 1;
  const cur = current();
  const arr = state[cur.side][cur.type === "ban" ? "bans" : "picks"];
  arr.pop();
  state.selected = null;
  render();
}

function resetRound() {
  state.step = 0;
  state.selected = null;
  state.red = emptyTeam();
  state.blue = emptyTeam();
  state.equipPhase = null;
  state.equipLog = [];
  state.eqSide = null;
  state.scrollsRevealed = false;
  state.summonsRevealed = false;
  state.eqSearch = "";
}

function nextRound() {
  state.round += 1;
  state.first = state.first === "red" ? "blue" : "red";
  resetRound();
  state.screen = "draft";
  render();
}

function render() {
  const app = $("#app");
  app.innerHTML = "";
  if (state.screen === "home") app.appendChild(homeView());
  else if (state.screen === "add") app.appendChild(addView());
  else if (state.screen === "fix") app.appendChild(fixView());
  else if (state.screen === "pubban") app.appendChild(pubbanView());
  else if (state.screen === "draft") app.appendChild(draftView());
  else app.appendChild(resultView());
}

function homeView() {
  const wrap = el("div", "screen home");
  const card = el("div", "home-card");
  card.innerHTML = '<div class="logo"><div class="mark">忍</div><h1>火影忍者</h1><p>武斗赛 BP</p></div>';
  const names = el("div", "row names");
  names.appendChild(namedInput("红方昵称", "redName", true));
  names.appendChild(namedInput("蓝方昵称", "blueName", false));
  card.appendChild(names);
  card.appendChild(segRow("先后手", [
    ["random", "随机"],
    ["red", "红方先手"],
    ["blue", "蓝方先手"]
  ], state.firstPref, (v) => {
    state.firstPref = v;
  }));
  card.appendChild(segRow("赛制", [
    ["3", "BO3"],
    ["5", "BO5"],
    ["7", "BO7"]
  ], String(state.bo), (v) => { state.bo = Number(v); }));
  const pub = el("button", "ghost", "设置公 Ban（已选 " + state.pubBans.length + "）");
  pub.onclick = () => { state.screen = "pubban"; render(); };
  card.appendChild(pub);
  const btn = el("button", "start", "开始 BP");
  btn.onclick = () => {
    const red = $('input[data-k="redName"]').value.trim() || "红方";
    const blue = $('input[data-k="blueName"]').value.trim() || "蓝方";
    state.redName = red;
    state.blueName = blue;
    const firstBtns = [...card.querySelectorAll("[data-seg='先后手'] button")];
    const firstOn = firstBtns.find((b) => b.classList.contains("on"));
    let first = firstOn ? firstOn.dataset.v : "random";
    state.firstPref = first;
    if (first === "random") first = Math.random() < 0.5 ? "red" : "blue";
    state.first = first;
    const boBtns = [...card.querySelectorAll("[data-seg='赛制'] button")];
    const boOn = boBtns.find((b) => b.classList.contains("on"));
    state.bo = boOn ? Number(boOn.dataset.v) : 3;
    state.round = 0;
    state.history = [];
    resetRound();
    state.screen = "draft";
    render();
  };
  card.appendChild(btn);
  wrap.appendChild(card);
  const actions = el("div", "home-actions");
  const addBtn = el("button", "", "添加");
  addBtn.onclick = () => {
    state.screen = "add";
    state.addKind = state.addKind || "ninja";
    state.addName = "";
    state.addImg = "";
    render();
  };
  const fixBtn = el("button", "", "修正名称");
  fixBtn.onclick = () => {
    state.screen = "fix";
    render();
  };
  actions.appendChild(addBtn);
  actions.appendChild(fixBtn);
  if (isAdmin()) {
    const exp = el("button", "", "导出");
    exp.onclick = exportOverrides;
    actions.appendChild(exp);
  }
  const footer = el("div", "home-footer");
  const gh = el("a", "gh-link");
  gh.href = "https://github.com/Marisa1028/NarutoBP";
  gh.target = "_blank";
  gh.rel = "noopener noreferrer";
  gh.textContent = "github.com/Marisa1028/NarutoBP";
  footer.appendChild(gh);
  footer.appendChild(actions);
  wrap.appendChild(footer);
  return wrap;
}

function addView() {
  const wrap = el("div", "screen home");
  const card = el("div", "home-card");
  card.appendChild(el("div", "logo", "")).innerHTML = "<h1>添加</h1><p>自选类型 · 名称 · 截图</p>";
  card.appendChild(segRow("类型", [
    ["ninja", "忍者"],
    ["scroll", "密卷"],
    ["summon", "通灵"]
  ], state.addKind || "ninja", (v) => { state.addKind = v; }));
  const nameRow = el("div", "row");
  nameRow.appendChild(el("label", "", "名称（中括号为后缀）"));
  const nameInp = el("input");
  nameInp.type = "text";
  nameInp.placeholder = "例：神秘面具男[百战]";
  nameInp.value = state.addName || "";
  nameInp.oninput = () => { state.addName = nameInp.value; };
  nameRow.appendChild(nameInp);
  card.appendChild(nameRow);
  const imgRow = el("div", "row");
  imgRow.appendChild(el("label", "", "截图"));
  const file = el("input");
  file.type = "file";
  file.accept = "image/*";
  const preview = el("img", "add-preview");
  if (state.addImg) preview.src = state.addImg;
  preview.style.display = state.addImg ? "block" : "none";
  file.onchange = () => {
    const f = file.files && file.files[0];
    if (!f) return;
    compressImage(f).then((data) => {
      state.addImg = data;
      preview.src = data;
      preview.style.display = "block";
    });
  };
  imgRow.appendChild(file);
  imgRow.appendChild(preview);
  card.appendChild(imgRow);
  const ok = el("button", "start", "确认添加");
  ok.onclick = () => {
    const name = (state.addName || "").trim();
    if (!name) {
      nameInp.focus();
      return;
    }
    addCustomItem(state.addKind || "ninja", name, state.addImg || "");
    state.addName = "";
    state.addImg = "";
    state.screen = "home";
    render();
  };
  card.appendChild(ok);
  const back = el("button", "ghost", "返回");
  back.onclick = () => { state.screen = "home"; render(); };
  card.appendChild(back);
  wrap.appendChild(card);
  return wrap;
}

function filteredFix() {
  const kind = state.fixTab;
  const q = state.fixSearch.trim();
  return FIX_LISTS[kind].filter((n) => {
    const orig = (ORIG_NAMES[kind][n.id] || {}).name || "";
    return matchesText(n, q) || orig.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => {
    if (kind === "ninja") {
      const d = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
      return d || (b.sort - a.sort);
    }
    return a.id.localeCompare(b.id, "zh") || a.name.localeCompare(b.name, "zh");
  });
}

function fixView() {
  const wrap = el("div", "screen draft");
  const bar = el("div", "topbar");
  const tabs = el("div", "phase-list");
  [["ninja", "忍者"], ["scroll", "密卷"], ["summon", "通灵"]].forEach((t) => {
    const b = el("div", "phase-dot pick fix-tab" + (state.fixTab === t[0] ? " now" : ""), t[1]);
    b.onclick = () => {
      state.fixTab = t[0];
      render();
    };
    tabs.appendChild(b);
  });
  bar.appendChild(tabs);
  bar.appendChild(el("div", "turn", "点击名称即可修改，自动保存"));
  wrap.appendChild(bar);

  const board = el("div", "list-board");
  const col = el("div", "pool");
  const tools = el("div", "tools");
  tools.appendChild(searchBox("搜索名称 / 称号 / 别名", state.fixSearch, (v) => {
    state.fixSearch = v;
    const grid = $("#fixgrid");
    if (grid) fillFixGrid(grid);
  }));
  col.appendChild(tools);
  const grid = el("div", "fix-grid");
  grid.id = "fixgrid";
  col.appendChild(grid);
  board.appendChild(col);
  wrap.appendChild(board);

  const bottom = el("div", "bottom");
  bottom.appendChild(el("div", "msg", "修改后自动保存，刷新即显示最新名称"));
  const actions = el("div", "actions");
  const reset = el("button", "", "还原本页");
  reset.onclick = () => {
    resetFixTab(state.fixTab);
    render();
  };
  const done = el("button", "ok", "完成");
  done.onclick = () => { state.screen = "home"; render(); };
  actions.appendChild(reset);
  actions.appendChild(done);
  bottom.appendChild(actions);
  wrap.appendChild(bottom);
  fillFixGrid(grid);
  return wrap;
}

function fillFixGrid(grid) {
  grid.innerHTML = "";
  const kind = state.fixTab;
  filteredFix().forEach((n) => {
    const orig = ORIG_NAMES[kind][n.id];
    const row = el("div", "fix-row");
    const img = el("img");
    img.src = IMG(n.id);
    img.alt = n.name;
    img.onerror = () => { img.remove(); };
    const box = el("div", "fix-meta");
    const inp = el("input");
    inp.type = "text";
    inp.value = n.name;
    const prefix = el("span", "", n.title || "");
    inp.oninput = () => {
      const item = setItemName(kind, n.id, inp.value);
      prefix.textContent = item ? item.title : "";
    };
    inp.onblur = () => {
      if (!inp.value.trim()) {
        inp.value = orig.name;
        const item = setItemName(kind, n.id, orig.name);
        prefix.textContent = item ? item.title : orig.title;
      }
    };
    box.appendChild(inp);
    box.appendChild(prefix);
    row.appendChild(img);
    row.appendChild(box);
    grid.appendChild(row);
  });
}

function pubbanView() {
  const wrap = el("div", "screen draft");
  const bar = el("div", "topbar");
  bar.appendChild(el("div", "turn", "设置公 Ban · 已选 " + state.pubBans.length + " 人"));
  bar.appendChild(el("div", "timer", "全局生效"));
  wrap.appendChild(bar);

  const board = el("div", "list-board");
  const col = el("div", "pool");
  const tools = el("div", "tools");
  tools.appendChild(searchBox("搜索忍者 / 称号 / 别名", state.pubSearch, (v) => {
    state.pubSearch = v;
    const grid = $("#pubgrid");
    if (grid) fillPubGrid(grid);
  }));
  col.appendChild(tools);
  col.appendChild(rankFilters());

  const grid = el("div", "ninja-grid");
  grid.id = "pubgrid";
  col.appendChild(grid);
  board.appendChild(col);
  wrap.appendChild(board);

  const bottom = el("div", "bottom");
  bottom.appendChild(el("div", "msg", ""));
  const actions = el("div", "actions");
  const clear = el("button", "", "一键清除");
  clear.onclick = () => {
    state.pubBans = [];
    render();
  };
  const done = el("button", "ok", "完成");
  done.onclick = () => { state.screen = "home"; render(); };
  actions.appendChild(clear);
  actions.appendChild(done);
  bottom.appendChild(actions);
  wrap.appendChild(bottom);
  fillPubGrid(grid);
  return wrap;
}

function fillPubGrid(grid) {
  grid.innerHTML = "";
  const picked = {};
  state.pubBans.forEach((id) => { picked[id] = 1; });
  filtered(state.pubSearch).forEach((n) => {
    const on = !!picked[n.id];
    grid.appendChild(ninjaCard(n, on ? " on" : "", on ? { cls: "pub", text: "公BAN" } : null, () => {
      const i = state.pubBans.indexOf(n.id);
      if (i >= 0) state.pubBans.splice(i, 1);
      else state.pubBans.push(n.id);
      render();
    }));
  });
}

function namedInput(label, key, red) {
  const box = el("div");
  const lab = el("label", "", label);
  const inp = el("input");
  inp.type = "text";
  inp.value = state[key];
  inp.dataset.k = key;
  inp.maxLength = 12;
  if (red) inp.style.borderColor = "#5a2424";
  else inp.style.borderColor = "#24385a";
  box.appendChild(lab);
  box.appendChild(inp);
  return box;
}

function segRow(label, items, value, onPick) {
  const row = el("div", "row");
  row.appendChild(el("label", "", label));
  const seg = el("div", "seg");
  seg.dataset.seg = label;
  items.forEach(([v, t]) => {
    const b = el("button", value === v ? "on" : "", t);
    b.dataset.v = v;
    b.onclick = () => {
      [...seg.children].forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      onPick(v);
    };
    seg.appendChild(b);
  });
  row.appendChild(seg);
  return row;
}

function draftView() {
  const wrap = el("div", "screen draft");
  wrap.appendChild(topbar());
  const board = el("div", "board" + (state.equipPhase ? " dual-eq" : ""));
  board.appendChild(teamCol("red"));
  board.appendChild(state.equipPhase ? equipPools() : poolCol());
  board.appendChild(teamCol("blue"));
  wrap.appendChild(board);
  wrap.appendChild(bottomBar());
  return wrap;
}

function topbar() {
  const bar = el("div", "topbar");
  const list = el("div", "phase-list");
  const eq = currentEquip();
  if (eq) {
    const label = eq.type === "scroll" ? "密" : "灵";
    ["red", "blue"].forEach((side) => {
      const n = equipCount(side);
      for (let i = 0; i < 3; i++) {
        const d = el("div", "phase-dot pick" + (i === n && n < 3 ? " now" : "") + (i < n ? " done" : ""), (side === "red" ? "红" : "蓝") + label + (i + 1));
        list.appendChild(d);
      }
    });
  } else {
    SEQ.forEach((s, i) => {
      const side = sideOf(s[0]) === "red" ? "红" : "蓝";
      const d = el("div", "phase-dot " + s[1] + (i === state.step ? " now" : "") + (i < state.step ? " done" : ""), side + (s[1] === "ban" ? "禁" : "选"));
      list.appendChild(d);
    });
  }
  let turn;
  if (eq) {
    const kind = eq.type === "scroll" ? "密卷" : "通灵";
    turn = el("div", "turn", "双方选择" + kind + "　红 " + equipCount("red") + "/3　蓝 " + equipCount("blue") + "/3");
  } else {
    const cur = current();
    turn = el("div", "turn " + (cur ? cur.side : ""), cur ? ((cur.side === "red" ? state.redName : state.blueName) + (cur.type === "ban" ? " 禁用中" : " 选择中")) : "BP 结束");
  }
  const sc = seriesScore();
  const round = el("div", "timer", "BO" + state.bo + " " + sc.red + ":" + sc.blue);
  bar.appendChild(list);
  bar.appendChild(turn);
  bar.appendChild(round);
  return bar;
}

function teamCol(side) {
  const col = el("div", "team " + side);
  const name = side === "red" ? state.redName : state.blueName;
  const first = state.first === side ? " · 先手" : " · 后手";
  col.appendChild(el("h3", "", name + first));
  const bans = el("div", "slots");
  for (let i = 0; i < 2; i++) bans.appendChild(slotView(state[side].bans[i], "ban", "禁用 " + (i + 1)));
  const picks = el("div", "slots");
  picks.style.marginTop = "12px";
  const eq = currentEquip();
  for (let i = 0; i < 3; i++) {
    const picking = !!(eq && equipCount(side) === i);
    picks.appendChild(slotView(state[side].picks[i], "pick", "出战 " + (i + 1), side, picking));
  }
  col.appendChild(bans);
  col.appendChild(picks);
  return col;
}

function slotView(id, type, empty, side, picking) {
  const box = el("div", "slot " + type + (id ? "" : " empty") + (picking ? " picking" : ""));
  if (!id) {
    box.textContent = empty;
    return box;
  }
  const n = findNinja(id);
  const img = el("img", "mini");
  img.src = IMG(id);
  img.alt = showName(n);
  const meta = el("div", "meta");
  meta.appendChild(el("b", "", showName(n)));
  meta.appendChild(el("span", "", n.kind === "legend" ? n.name : (n.title || type.toUpperCase())));
  if (type === "pick" && side) {
    const tags = el("div", "eq");
    if (state.scrollsRevealed) {
      const sid = equipOf(side, id, "scrolls");
      const sc = sid ? findScroll(sid) : null;
      if (sc) tags.appendChild(el("span", "eq-scroll", sc.name));
    }
    if (state.summonsRevealed) {
      const mid = equipOf(side, id, "summons");
      const sm = mid ? findSummon(mid) : null;
      if (sm) tags.appendChild(el("span", "eq-summon", sm.name));
    }
    if (picking) tags.appendChild(el("span", "eq-wait", (state.equipPhase === "scroll" ? "密卷" : "通灵") + "选择中"));
    if (tags.childNodes.length) meta.appendChild(tags);
  }
  box.appendChild(img);
  box.appendChild(meta);
  return box;
}

function equipPools() {
  const col = el("div", "pool eq-pools");
  const tools = el("div", "tools");
  tools.appendChild(searchBox(state.equipPhase === "scroll" ? "搜索密卷" : "搜索通灵", state.eqSearch, (v) => {
    state.eqSearch = v;
    refreshEquipGrid();
  }));
  col.appendChild(tools);
  const row = el("div", "eq-pool-row");
  row.appendChild(equipPoolCol("red"));
  row.appendChild(equipPoolCol("blue"));
  col.appendChild(row);
  return col;
}

function equipPoolCol(side) {
  const box = el("div", "eq-pool " + side);
  const kind = state.equipPhase === "scroll" ? "密卷" : "通灵";
  box.appendChild(el("h3", "", (side === "red" ? state.redName : state.blueName) + " " + kind + " " + equipCount(side) + "/3"));
  const grid = el("div", "ninja-grid");
  grid.id = "eqgrid-" + side;
  box.appendChild(grid);
  fillEquipGrid(grid, side);
  return box;
}

function poolCol() {
  const col = el("div", "pool");
  const tools = el("div", "tools");
  tools.appendChild(searchBox("搜索忍者 / 称号 / 别名", state.search, (v) => {
    state.search = v;
    refreshGrid();
  }));
  col.appendChild(tools);
  col.appendChild(rankFilters());
  const grid = el("div", "ninja-grid");
  grid.id = "grid";
  col.appendChild(grid);
  fillGrid(grid);
  return col;
}

function refreshGrid() {
  const grid = $("#grid");
  if (grid) fillGrid(grid);
}

function refreshEquipGrid() {
  const red = $("#eqgrid-red");
  const blue = $("#eqgrid-blue");
  if (red) fillEquipGrid(red, "red");
  if (blue) fillEquipGrid(blue, "blue");
}

function filteredEquips() {
  const q = state.eqSearch.trim();
  return equipList().filter((n) => matchesText(n, q)).sort((a, b) => a.id.localeCompare(b.id, "zh") || a.name.localeCompare(b.name, "zh"));
}

function fillEquipGrid(grid, side) {
  grid.innerHTML = "";
  const used = usedEquips(side);
  const done = equipCount(side) >= 3;
  filteredEquips().forEach((n) => {
    const on = state.eqSide === side && state.selected === n.id;
    const card = el("div", "card eq-card" + (on ? " on" : "") + (used[n.id] || done ? " used" : ""));
    const img = el("img");
    img.src = IMG(n.id);
    img.alt = n.name;
    img.onerror = () => {
      img.remove();
      card.classList.add("no-img");
    };
    const info = el("div", "eq-info");
    info.appendChild(el("div", "title", n.title || (state.equipPhase === "scroll" ? "密卷" : "通灵")));
    info.appendChild(el("div", "name", n.name));
    card.appendChild(img);
    card.appendChild(info);
    if (used[n.id]) card.appendChild(el("div", "stamp " + used[n.id], used[n.id] === "pick" ? "已选" : "已用"));
    card.onclick = () => {
      if (used[n.id] || done) return;
      if (state.eqSide === side && state.selected === n.id) confirmEquip(n.id, side);
      else {
        state.selected = n.id;
        state.eqSide = side;
        refreshEquipGrid();
        const ok = $("#okBtn");
        if (ok) ok.disabled = false;
      }
    };
    grid.appendChild(card);
  });
}

function fillGrid(grid) {
  grid.innerHTML = "";
  const used = usedMap();
  filtered().forEach((n) => {
    const stamp = used[n.id] ? {
      cls: used[n.id],
      text: used[n.id] === "ban" ? "BAN" : used[n.id] === "pick" ? "PICK" : used[n.id] === "pub" ? "公BAN" : "已用"
    } : null;
    const card = ninjaCard(n, (state.selected === n.id ? " on" : "") + (used[n.id] ? " used" : ""), stamp, () => {
      if (used[n.id]) return;
      if (state.selected === n.id) confirmPick(n.id);
      else {
        state.selected = n.id;
        [...grid.children].forEach((c) => c.classList.remove("on"));
        card.classList.add("on");
        const ok = $("#okBtn");
        if (ok) ok.disabled = false;
      }
    });
    grid.appendChild(card);
  });
}

function bottomBar() {
  const bar = el("div", "bottom");
  const eq = currentEquip();
  let msg = "";
  if (eq && state.selected) {
    const item = equipList().find((x) => x.id === state.selected);
    const who = state.eqSide === "red" ? state.redName : state.eqSide === "blue" ? state.blueName : "";
    msg = (item ? item.name : "") + (who ? " → " + who : "");
  } else if (eq) {
    msg = "左池红方、右池蓝方，可选用相同" + (eq.type === "scroll" ? "密卷" : "通灵") + "，双方选完后公开";
  } else if (state.selected) {
    const n = findNinja(state.selected);
    msg = n ? displayName(n) : "";
  }
  bar.appendChild(el("div", "msg", msg));
  const actions = el("div", "actions");
  const back = el("button", "", "返回");
  back.onclick = () => { state.screen = "home"; render(); };
  const u = el("button", "", "撤销");
  u.onclick = undo;
  let okText = "确认选择";
  if (eq) okText = eq.type === "scroll" ? "确认密卷" : "确认通灵";
  else if (current() && current().type === "ban") okText = "确认禁用";
  const ok = el("button", "ok", okText);
  ok.id = "okBtn";
  ok.disabled = !state.selected;
  ok.onclick = () => {
    if (!state.selected) return;
    if (eq) confirmEquip(state.selected, state.eqSide);
    else confirmPick(state.selected);
  };
  actions.appendChild(back);
  actions.appendChild(u);
  actions.appendChild(ok);
  bar.appendChild(actions);
  return bar;
}

function resultView() {
  const wrap = el("div", "screen result");
  const panel = el("div", "panel");
  const game = state.history[state.round] || snapshot();
  const sc = seriesScore();
  const over = seriesOver();
  panel.appendChild(el("div", "logo", "")).innerHTML = "<h1>BO" + state.bo + " · 第 " + (state.round + 1) + " 局</h1><p>" + state.redName + " " + sc.red + " : " + sc.blue + " " + state.blueName + "</p>";
  ["1", "2", "3"].forEach((k, i) => {
    const row = el("div", "vs");
    row.appendChild(vsItem(state.red.order[i], false, "red"));
    row.appendChild(el("div", "", "第" + k + "场"));
    row.appendChild(vsItem(state.blue.order[i], true, "blue"));
    panel.appendChild(row);
  });
  const banLine = el("p", "hint", "本局禁用 红：" + state.red.bans.map((id) => findNinja(id).name).join("、") + " ｜ 蓝：" + state.blue.bans.map((id) => findNinja(id).name).join("、"));
  panel.appendChild(banLine);

  if (!game.winner) {
    const ask = el("p", "hint", "本局结果");
    ask.style.marginTop = "18px";
    panel.appendChild(ask);
    const row = el("div", "win-row");
    const redBtn = el("button", "win-red", state.redName + " 胜");
    const blueBtn = el("button", "win-blue", state.blueName + " 胜");
    redBtn.onclick = () => {
      state.history[state.round].winner = "red";
      render();
    };
    blueBtn.onclick = () => {
      state.history[state.round].winner = "blue";
      render();
    };
    row.appendChild(redBtn);
    row.appendChild(blueBtn);
    panel.appendChild(row);
  } else {
    const winName = game.winner === "red" ? state.redName : state.blueName;
    panel.appendChild(el("p", "hint", "本局胜者：" + winName));
  }

  if (state.history.some((g) => g.winner)) {
    const hist = el("div", "hint");
    hist.style.textAlign = "left";
    hist.style.marginTop = "16px";
    hist.appendChild(el("b", "", "系列战报"));
    state.history.forEach((g, i) => {
      hist.appendChild(document.createElement("br"));
      const w = g.winner ? (g.winner === "red" ? state.redName : state.blueName) + " 胜" : "待定";
      hist.appendChild(document.createTextNode(
        "第" + (i + 1) + "局 " + w + "　红：" + g.red.picks.map((id) => ninjaLine(g, "red", id)).join("/") +
        " ｜ 蓝：" + g.blue.picks.map((id) => ninjaLine(g, "blue", id)).join("/")
      ));
    });
    panel.appendChild(hist);
  }

  const copy = el("button", "copy", "复制结果");
  copy.onclick = () => {
    navigator.clipboard.writeText(resultText()).then(() => { copy.textContent = "已复制"; });
  };
  panel.appendChild(copy);
  if (game.winner && over) {
    const s = seriesScore();
    const champ = s.red > s.blue ? state.redName : state.blueName;
    panel.appendChild(el("p", "hint", champ + " 以 " + s.red + "-" + s.blue + " 结束系列赛"));
    const again = el("button", "start", "再开一轮");
    again.onclick = () => {
      state.firstPref = "random";
      state.screen = "home";
      render();
    };
    panel.appendChild(again);
  } else if (game.winner) {
    const next = el("button", "start", "第 " + (state.round + 2) + " 局 BP");
    next.onclick = nextRound;
    panel.appendChild(next);
  }
  wrap.appendChild(panel);
  return wrap;
}

function vsItem(id, right, side) {
  const n = findNinja(id);
  const box = el("div", "vs-item" + (right ? " right" : ""));
  if (!n) return box;
  const sc = side ? findScroll(equipOf(side, id, "scrolls")) : null;
  const sm = side ? findSummon(equipOf(side, id, "summons")) : null;
  const img = el("img", "mini");
  img.src = IMG(id);
  const meta = el("div", "meta");
  meta.appendChild(el("b", "", showName(n)));
  meta.appendChild(el("span", "vs-title", n.kind === "legend" ? n.name : (n.title || n.rank + "忍")));
  if (sc || sm) {
    const tags = el("div", "eq");
    if (sc) tags.appendChild(el("span", "eq-scroll", sc.name));
    if (sm) tags.appendChild(el("span", "eq-summon", sm.name));
    meta.appendChild(tags);
  }
  box.appendChild(img);
  box.appendChild(meta);
  return box;
}

function ninjaLine(g, side, id) {
  const n = findNinja(id);
  const i = g[side].picks.indexOf(id);
  const sc = i >= 0 ? findScroll((g[side].scrolls || [])[i]) : null;
  const sm = i >= 0 ? findSummon((g[side].summons || [])[i]) : null;
  let s = n ? showName(n) : "";
  if (sc) s += "+" + sc.name;
  if (sm) s += "+" + sm.name;
  return s;
}

function resultText() {
  const line = (ids) => ids.map((id) => displayName(findNinja(id))).join(" / ");
  const vsLine = (g, i) => ninjaLine(g, "red", g.red.order[i]) + " vs " + ninjaLine(g, "blue", g.blue.order[i]);
  const rows = [
    "【火影忍者手游 武斗赛 BP】BO" + state.bo,
    state.redName + " VS " + state.blueName,
    "先手：" + (state.first === "red" ? state.redName : state.blueName)
  ];
  state.history.forEach((g, i) => {
    rows.push("");
    rows.push("—— 第" + (i + 1) + "局 ——");
    rows.push("红方禁用：" + line(g.red.bans));
    rows.push("蓝方禁用：" + line(g.blue.bans));
    rows.push("第1场：" + vsLine(g, 0));
    rows.push("第2场：" + vsLine(g, 1));
    rows.push("第3场：" + vsLine(g, 2));
    if (g.winner) rows.push("胜者：" + (g.winner === "red" ? state.redName : state.blueName));
  });
  const s = seriesScore();
  rows.push("");
  rows.push("比分：" + state.redName + " " + s.red + " : " + s.blue + " " + state.blueName);
  return rows.join("\n");
}

loadSharedItems();
loadCustomItems();
snapshotOrigNames();
applyNameFixes();
render();
