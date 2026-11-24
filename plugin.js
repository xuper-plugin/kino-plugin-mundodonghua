// src/util/unpack.js
var ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
var toNum = (s, radix) => [...s].reduce((n, ch) => n * radix + ALPHA.indexOf(ch), 0);
function unpack(source) {
  const m = /}\s*\(\s*'((?:\\'|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'\.split\('\|'\)/.exec(source || "");
  if (!m) return null;
  const payload = m[1].replace(/\\'/g, "'");
  const radix = Number(m[2]);
  const keys = m[4].split("|");
  if (radix < 2 || radix > 62) return null;
  return payload.replace(/\b[0-9a-zA-Z]+\b/g, (w) => {
    const i = toNum(w, radix);
    return Number.isInteger(i) && i >= 0 && keys[i] ? keys[i] : w;
  });
}

// src/mundodonghua.js
var SITE = "https://www.mundodonghua.com";
var decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&#8217;/g, "\u2019").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
var strip = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
var abs = (u) => {
  try {
    return new URL(decode(u), SITE + "/").href;
  } catch (_) {
    return void 0;
  }
};
var GENRES = [
  "Acci\xF3n",
  "Artes Marciales",
  "Aventura",
  "Ciencia Ficci\xF3n",
  "Comedia",
  "Cultivaci\xF3n",
  "Demonios",
  "Drama",
  "Ecchi",
  "Escolar",
  "Fantas\xEDa",
  "Harem",
  "Historico",
  "Magia",
  "Mechas",
  "Misterio",
  "Mitolog\xEDa",
  "M\xFAsica",
  "Psicol\xF3gico",
  "Reencarnaci\xF3n",
  "Romance",
  "Seinen",
  "Shonen",
  "Sobrenatural",
  "Superpoderes",
  "Suspenso",
  "Terror",
  "Vampiros",
  "Venganza",
  "Viaje a Otro Mundo",
  "Videojuegos",
  "Zombis"
];
var isDubbed = (title) => /\b(latino|castellano)\b/i.test(String(title || ""));
function parseCards(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const block of String(html || "").split(/<div class="md-card">/).slice(1)) {
    const href = (/<a\b[^>]*\bhref="([^"]+)"/.exec(block) || [])[1] || "";
    const ver = /\/ver\/([^/?#"]+)\/(\d+)/.exec(href);
    const slugRaw = ver ? ver[1] : (/\/donghua\/([^/?#"]+)/.exec(href) || [])[1];
    if (!slugRaw) continue;
    let slug = slugRaw;
    try {
      slug = decodeURIComponent(slugRaw);
    } catch (_) {
    }
    const raw = strip((/<h[1-6][^>]*class="md-card-title"[^>]*>([\s\S]*?)<\/h[1-6]>/.exec(block) || [])[1]);
    if (!raw || seen.has(slug)) continue;
    seen.add(slug);
    const img = (/<img\b[^>]*\bsrc="([^"]+)"/.exec(block) || [])[1];
    const badge = strip((/<span class="md-card-badge[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(block) || [])[1]);
    const card = { slug, title: ver ? raw.replace(/\s+Episodio\s+\d+\s*$/i, "").trim() || raw : raw, poster: img ? abs(img) : void 0, badge };
    if (ver) card.episode = Number(ver[2]);
    out.push(card);
  }
  return out;
}
function parseShow(html) {
  const s = String(html || "");
  const g = (re) => strip((re.exec(s) || [])[1]);
  const poster = (/<div class="md-detail-poster"[\s\S]*?<img[^>]*\bsrc="([^"]+)"/.exec(s) || /property="og:image"[^>]*content="([^"]+)"/.exec(s) || [])[1];
  const badge = g(/<span class="md-card-badge md-badge-static[^"]*"[^>]*>([\s\S]*?)<\/span>/);
  const episodes2 = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of s.matchAll(/<li class="md-episode-item[^"]*"[^>]*>\s*<a\b[^>]*\bhref="(\/ver\/[^"]+\/(\d+))"/g)) {
    const n = Number(m[2]);
    if (seen.has(n)) continue;
    seen.add(n);
    episodes2.push({ number: n, href: m[1] });
  }
  episodes2.sort((a, b) => a.number - b.number);
  return {
    title: g(/class="md-detail-title"[^>]*>([\s\S]*?)<\//),
    overview: g(/class="md-detail-synopsis"[^>]*>([\s\S]*?)<\/(?:p|div)>/),
    poster: poster ? abs(poster) : void 0,
    genres: [...s.matchAll(/class="md-genre-tag"[^>]*>([\s\S]*?)<\//g)].map((m) => strip(m[1])).filter(Boolean).slice(0, 6),
    status: g(/class="md-emision-badge"[^>]*>([\s\S]*?)<\//),
    type: badge,
    episodes: episodes2
  };
}
function parseServers(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/eval\(function\(p,a,c,k,e,[\s\S]*?\)\)\s*(?=;|<|\n|$)/g)) {
    const code = unpack(m[0]);
    if (!code) continue;
    const id = (/\$\("#([a-z0-9_]+?)_tab"\)/i.exec(code) || [])[1];
    if (!id) continue;
    const frame = /<iframe\s+src=['"]([^'"]+)['"]/i.exec(code);
    const file = /file\s*:\s*"([^"]+)"/.exec(code);
    const url = frame ? frame[1] : file ? file[1] : null;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (!out.some((x) => x.id === id)) out.push({ id, kind: frame ? "iframe" : "hls", url });
  }
  return out;
}

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var REQUEST_MS = 8e3;
var MIN_MS = 1500;
function makeReq(kino2, { deadline }) {
  const req = async (url, opts = {}) => {
    const left = deadline - Date.now();
    if (left < MIN_MS) throw kino2.error("timeout", "no time left for " + new URL(url).hostname);
    return kino2.fetch(url, { headers: { "User-Agent": UA, ...opts.headers || {} }, method: opts.method, body: opts.body, timeoutMs: Math.min(opts.timeoutMs || REQUEST_MS, left) });
  };
  req.left = () => Math.max(0, deadline - Date.now());
  return req;
}

// src/std/model.js
var MAX_SLIDES = 5;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.badges) out.badges = item.badges;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.lang) out.lang = item.lang;
  if (item.adult === true) out.adult = true;
  return out;
}
var slidesOf = (rows) => pickSlides(rows, (item) => item.backdrop);
var posterSlidesOf = (rows) => pickSlides(rows, (item) => item.poster);
function slideText(overview, item = {}) {
  const text = typeof overview === "string" ? overview.trim() : "";
  if (text === "") return [item.year, item.rating ? "\u2605 " + item.rating : null].filter(Boolean).join(" \xB7 ");
  return text.length <= MAX_SLIDE_TEXT ? text : `${text.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`;
}
function pickSlides(rows, pictureOf) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items || []) {
      if (out.length >= MAX_SLIDES) return out;
      const image = pictureOf(item);
      if (item.adult === true || seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: slideText(item.overview, item) });
    }
  }
  return out;
}
var uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
function railsOf(rows) {
  return rows.filter((r) => !r.hidden && r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.titleEn ? { titleEn: r.titleEn } : {},
    ...r.ref ? { ref: r.ref } : {},
    items: uniform(r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf))
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), posterSlides: posterSlidesOf(rows), rails };
}
function playedKey(ref) {
  const m = /^(?:m|s|e):(\d{1,10})(?::|$)/.exec(String(ref || ""));
  return m ? `t:${m[1]}` : String(ref || "");
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const ks = [card.ref];
        if (card.ids && card.ids.tmdb) ks.push(`t:${card.ids.tmdb}`);
        for (const k of ks) if (!byKey.has(k)) byKey.set(k, card);
      }
    }
  }
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byKey.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/std/strings.js
var WORDS = {
  watch: ["Ver", "Watch"],
  info: ["M\xE1s informaci\xF3n", "More info"],
  recent: ["Continuar viendo", "Continue watching"],
  search: ["Buscar", "Search"],
  searchHint: ["Buscar en {name}", "Search {name}"],
  failed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  retry: ["Reintentar", "Retry"],
  empty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  back: ["Atr\xE1s", "Back"],
  close: ["Cerrar", "Close"],
  settings: ["Ajustes", "Settings"],
  resultsTitle: ["Resultados: {q}", "Results: {q}"],
  resultsIn: ["En {name}", "In {name}"],
  resultsSearching: ["Buscando en {name}\u2026", "Searching {name}\u2026"],
  resultsFailed: ["{name} no respondi\xF3 esta vez.", "{name} did not answer this time."],
  noResults: ["No encontramos nada con esas palabras en tus plugins.", "Nothing in your plugins matched those words."],
  supportTv: ["Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", "If you like my work, scan it and support me"],
  support: ["Si te gusta mi trabajo, ap\xF3yame", "If you like my work, support me"],
  gateTitle: ["Necesitas el motor de reproducci\xF3n", "You need the playback engine"],
  gateText: [
    "{name} reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.",
    "{name} plays through Kino Resolver (free). Install it once and it works here and in other site plugins."
  ],
  gateInstall: ["Instalar Kino Resolver", "Install Kino Resolver"]
};
var fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
function twin(key, field = "text", vars) {
  const [es, en] = WORDS[key];
  const pick = (i) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? v[i] : v]));
  return { [field]: fill(es, pick(0)), [field + "En"]: fill(en, pick(1)) };
}
var STRING_KEYS = Object.keys(WORDS);

// src/std/view.js
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var POLL_MS = 1500;
function brand(cfg) {
  return {
    type: "Row",
    key: "brand",
    gap: 12,
    crossAxisAlignment: "center",
    children: [
      ...cfg.logo ? [{ type: "Image", key: "logo", url: cfg.logo, aspect: cfg.logoAspect || "1:1", fit: "contain", h: 32, alt: cfg.name, altEn: cfg.nameEn || cfg.name }] : [],
      { type: "Text", key: "name", style: "h4", text: cfg.name, textEn: cfg.nameEn || cfg.name }
    ]
  };
}
var tabBar = (tabs, active) => ({
  type: "TabBar",
  key: "tabs",
  divider: false,
  value: active,
  onChanged: "tab",
  tabs: tabs.map((t2) => ({ value: t2.id, label: t2.label, labelEn: t2.labelEn || t2.label }))
});
var iconButton = (key, icon, word, onPressed) => ({ type: "IconButton", key, icon, ...twin(word, "labelText"), ...twin(word, "tooltip"), onPressed });
var searchOpenOps = (tabsInBar) => [
  { hide: "close" },
  { hide: "brand" },
  { hide: "searchButton" },
  { hide: "settingsButton" },
  ...tabsInBar ? [{ hide: "tabs" }] : [],
  { show: "closeSearch" },
  { show: "q" },
  { focus: "q" }
];
var searchClosedOps = (tabsInBar) => [
  { hide: "closeSearch" },
  { hide: "q" },
  { clear: "q" },
  { show: "close" },
  { show: "brand" },
  { show: "searchButton" },
  { show: "settingsButton" },
  ...tabsInBar ? [{ show: "tabs" }] : []
];
var leaveButton = (cfg) => cfg.backArrow ? iconButton("close", "arrow_back", "back", { go: { close: true } }) : iconButton("close", "close", "close", { go: { close: true } });
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", key: "donate", value: SUPPORT_URL, size: "large", ...twin("supportTv", "labelText") };
  return { type: "ElevatedButton", key: "donate", icon: "heart", ...twin("support", "labelText"), onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
var bar = ({ leading, title, actions = [] }) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading, title, actions });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var titleOf = (s) => ({ ref: s.ref, kind: s.kind, id: s.id, title: s.title });
var withHeaders = (headers) => headers ? { headers } : {};
var slideNode = (s, headers) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  ...withHeaders(headers),
  buttons: [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("watch", "labelText"), icon: "play", onPressed: { go: { play: titleOf(s) } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("info", "labelText"), onPressed: { go: { title: titleOf(s) } } }
  ]
});
var hero = (slides, headers) => slides.length === 1 ? slideNode(slides[0], headers) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map((s) => slideNode(s, headers))
};
var rail = (r, key, words, headers) => ({
  type: "titleRail",
  key,
  ...words || { title: r.title, titleEn: r.titleEn || r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  ...withHeaders(headers)
});
function browseView(cfg, { tab, data, recent, pending, failed, searching = false, device = "phone", own = null }) {
  const tv = device === "tv";
  const tabs = own ? [cfg.tabs[0]] : cfg.tabs;
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const withTabs = tabs.length > 1;
  const body = [];
  if (own) {
    body.push(...own);
  } else if (data) {
    const h = cfg.imageHeaders;
    if (data.slides.length > 0) body.push(hero(data.slides, h));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("recent", "title"), h));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, h));
    if (data.rails.length === 0) body.push({ type: "Text", key: "empty", ...twin("empty"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("failed"), action: { ...twin("retry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  const tabsInBar = tv && withTabs;
  const appBar = bar({
    leading: leaveButton(cfg),
    title: { type: "Row", key: "titleRow", gap: tabsInBar ? 24 : 8, crossAxisAlignment: "center", children: [
      { ...iconButton("closeSearch", "arrow_back", "back", { ui: searchClosedOps(tabsInBar), event: "searchClosed" }), hidden: true },
      brand(cfg),
      ...tabsInBar ? [tabBar(tabs, active)] : [],
      {
        type: "TextField",
        key: "q",
        hidden: true,
        flex: 1,
        kind: "search",
        maxLength: 200,
        ...twin("searchHint", "hintText", { name: [cfg.name, cfg.nameEn || cfg.name] }),
        onSubmitted: "search",
        trailingIcon: "search",
        ...twin("search", "trailingLabel"),
        onTrailingTap: "search"
      }
    ] },
    actions: [
      // barSearch: false (std 1.7.0): the plugin draws its own search field in its page instead of the bar's icon.
      ...cfg.barSearch ? [iconButton("searchButton", "search", "search", { ui: searchOpenOps(tabsInBar), event: "searchOpened" })] : [],
      iconButton("settingsButton", "settings", "settings", "openSettings")
    ]
  });
  return {
    type: "Scaffold",
    ...searching ? { onBack: { ui: searchClosedOps(tabsInBar), event: "searchClosed" } } : {},
    appBar,
    body: { type: "Column", key: "page", children: [
      ...withTabs && !tv ? [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }] : [],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function resultsView(cfg, { q, order, names, pending, found, device = "phone" }) {
  const body = [];
  let shown = 0;
  order.forEach((repo, i) => {
    const name = [names[repo] || repo, names[repo] || repo];
    if (pending.includes(repo)) {
      body.push({ type: "Column", key: "wait-" + i, gap: 8, children: [{ type: "Text", key: "waitText-" + i, color: "muted", ...twin("resultsSearching", "text", { name }) }, railSkeleton(i)] });
      return;
    }
    const r = found.get(repo);
    if (!r || !r.ok) {
      body.push({ type: "Text", key: "failed-" + i, color: "muted", ...twin("resultsFailed", "text", { name }) });
      return;
    }
    if (!r.items.length) return;
    shown++;
    body.push(rail({ items: r.items }, "found-" + i, twin("resultsIn", "title", { name }), cfg.imageHeaders));
  });
  if (!pending.length && shown === 0 && order.some((r) => {
    const x = found.get(r);
    return x && x.ok;
  })) body.unshift({ type: "Text", key: "noResults", ...twin("noResults") });
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: { type: "Text", key: "resultsTitle", style: "h4", ...twin("resultsTitle", "text", { q }) } }),
    body: { type: "SingleChildScrollView", key: "results-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...pending.length ? { every: { ms: 1500, event: "tick" } } : {}
  };
}
function settingsView(cfg, device = "phone") {
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: brand(cfg) }),
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [
      ...cfg.hasSettings ? [{ type: "settings", key: "form" }, { type: "Divider", key: "supportDivider" }] : [],
      supportNode(device)
    ] }] }
  };
}
function gateView(cfg, device = "phone") {
  const name = [cfg.name, cfg.nameEn || cfg.name];
  return {
    type: "Scaffold",
    appBar: bar({ leading: leaveButton(cfg), title: brand(cfg) }),
    body: { type: "Column", key: "gate", mainAxisAlignment: "center", crossAxisAlignment: "center", padding: 24, gap: 16, children: [
      { type: "Text", key: "gateTitle", style: "h3", ...twin("gateTitle") },
      { type: "Text", key: "gateText", style: "p", ...twin("gateText", "text", { name }) },
      { type: "ElevatedButton", key: "installResolver", ...twin("gateInstall", "labelText"), onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
      supportNode(device)
    ] }
  };
}

// src/std/metaCache.js
var KEY = "meta3";
var MAX = 160;
var CONCURRENCY = 3;
var OVERVIEW_MAX = 160;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf: titleOf2 = (c) => c.title, typeOf = (c) => c.kind === "series" ? "series" : "movie", tmdbPictures = false, clock = { now: () => Date.now() } }) {
  const usable = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read()[id];
    if (!e) return {};
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.p && HTTPS2.test(e.p) ? { poster: e.p } : {},
      ...e.b && HTTPS2.test(e.b) ? { backdrop: e.b } : {},
      ...typeof e.o === "string" && e.o ? { overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const poster = tmdbPictures && k.poster ? k.poster : null;
      if (!k.tmdb && !poster) return c;
      return { ...c, ...k.tmdb && !(c.ids && c.ids.tmdb) ? { ids: { ...c.ids || {}, tmdb: k.tmdb } } : {}, ...poster ? { poster } : {} };
    });
  }
  async function fill2(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let count = 0;
    let stop = false;
    const seen = /* @__PURE__ */ new Set();
    const todo = cards.filter((c) => {
      if (!c || typeof c.id !== "string" || seen.has(c.id) || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) return false;
      seen.add(c.id);
      return true;
    });
    let next = 0;
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const worker = async () => {
      while (!stop && next < todo.length && clock.now() < end) {
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: typeOf(c), title: titleOf2(c), ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: str(a && a.logo, 2048),
            p: str(a && a.poster, 2048),
            b: str(a && a.backdrop, 2048),
            o: str(a && a.overview, OVERVIEW_MAX)
          };
          count++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (count > 0) write();
    return count;
  }
  return { known, asked, dress, fill: fill2, usable, tmdbPictures };
}

// src/std/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var SNAPS_TOTAL = 96 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var Q_MAX = 200;
var META_TICK_MS = 3e3;
var META_TICK_CARDS = 24;
var INFLIGHT_KEY = "std:inflight";
var INFLIGHT_STALE_MS = 18e3;
var MAX_META_TICKS = 10;
var DEFAULT_TABS = [{ id: "inicio", label: "Inicio", labelEn: "Home" }];
var SNAPSHOT_VERSION = 1;
var SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1e3;
var SNAPSHOT_TIMEOUT_MS = 8e3;
var snapshotUrl = (repo, tab) => "https://raw.githubusercontent.com/" + repo + "/main/home/" + encodeURIComponent(tab) + ".json";
function snapshotRows(text, tab, now = Date.now()) {
  let o;
  try {
    o = JSON.parse(String(text));
  } catch (_) {
    return null;
  }
  if (!o || o.v !== SNAPSHOT_VERSION || o.tab !== tab || !Array.isArray(o.rows) || o.rows.length === 0) return null;
  const at = Number(o.at);
  if (!Number.isFinite(at) || now - at > SNAPSHOT_MAX_AGE_MS || at - now > 60 * 60 * 1e3) return null;
  return o.rows;
}
var lastSource = null;
function makeStandardScreen({ kino: kino2, name, nameEn, logo = null, logoAspect = "1:1", needsResolver, hasSettings, tabs, loadTab, homeKey = null, titleOf: titleOf2, typeOf, tmdbPictures = false, imageHeaders = null, searchHere = null, page = null, barSearch = true, backArrow = true, snapshot = null }) {
  const cfg = { name, nameEn, logo, logoAspect, imageHeaders, hasSettings: !!hasSettings, barSearch: barSearch !== false, backArrow: backArrow !== false, tabs: Array.isArray(tabs) && tabs.length > 0 ? tabs : DEFAULT_TABS };
  const TAB_IDS = cfg.tabs.map((t2) => t2.id);
  lastSource = { tabs: cfg.tabs, loadTab, titleOf: titleOf2, typeOf };
  async function fromSnapshot(tab) {
    if (typeof snapshot !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(snapshot)) return null;
    try {
      const r = await kino2.fetch(snapshotUrl(snapshot, tab), { timeoutMs: SNAPSHOT_TIMEOUT_MS });
      if (!r || !r.ok) return null;
      const rows = snapshotRows(await r.text(), tab);
      return rows ? { rows } : null;
    } catch (_) {
      return null;
    }
  }
  const meta = makeMetaCache({ kino: kino2, titleOf: titleOf2, typeOf, tmdbPictures });
  function slidesFromMeta(rails) {
    const out = [];
    for (const r of rails) {
      for (const c of r.items) {
        if (out.length >= MAX_SLIDES) return out;
        const k = meta.known(c.id);
        if (!k.backdrop || c.adult === true || out.some((x) => x.id === c.id)) continue;
        out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: slideText(k.overview, c), ...k.logo ? { logo: k.logo } : {} });
      }
    }
    return out;
  }
  const enrich = (data) => {
    if (!data) return data;
    const own = data.slides.map((s) => {
      const k = meta.known(s.id);
      const image = tmdbPictures && k.backdrop ? k.backdrop : null;
      return k.logo || image ? { ...s, ...k.logo ? { logo: k.logo } : {}, ...image ? { image } : {} } : s;
    });
    const learned = own.length > 0 ? [] : slidesFromMeta(data.rails);
    return {
      // The site's own backdrops, else TMDB's, else the posters: every plugin has a hero.
      slides: own.length > 0 ? own : learned.length > 0 ? learned : data.posterSlides || [],
      rails: data.rails.map((r) => ({ ...r, items: meta.dress(r.items) }))
    };
  };
  const metaTicks = /* @__PURE__ */ new Map();
  const found = /* @__PURE__ */ new Map();
  const SOURCES_PER_TICK = 3;
  const asFound = (a, index) => ({
    ok: !!(a && a.ok),
    items: a && a.ok && Array.isArray(a.items) ? a.items.filter((x) => x && x.id && x.ref && x.title).slice(0, 40).map((x) => ({ ...x, id: ("p" + index + "~" + x.id).slice(0, 128), origin: a.repo })) : []
  });
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[std]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  const snapMax = Math.min(SNAP_MAX, Math.floor(SNAPS_TOTAL / TAB_IDS.length));
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim = { slides: data.slides, posterSlides: data.posterSlides || [], rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text = JSON.stringify({ at: Date.now(), data: slim });
      if (text.length <= snapMax) {
        set(SNAP_PREFIX + tab, text, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (!homeKey || tab !== TAB_IDS[0]) return null;
    try {
      const o = JSON.parse(get(homeKey) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab) || homeSeed(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(ref) {
    try {
      const key = playedKey(ref);
      if (key === "" || key.startsWith("x|")) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab) {
    return memo.get(tab) && memo.get(tab).whole ? [] : [tab];
  }
  function screen2(ctx) {
    const c = ctx || {};
    const device = c.device || "phone";
    if (needsResolver && !(c.installed && c.installed[RESOLVER_REPO])) return gateView(cfg, device);
    if (c.route && c.route.name === "settings") return settingsView(cfg, device);
    if (searchHere && c.route && c.route.name === "results") {
      const st0 = c.state && typeof c.state === "object" ? c.state : {};
      return resultsView(cfg, {
        q: String(st0.rq || ""),
        order: Array.isArray(st0.rorder) ? st0.rorder : [],
        names: st0.rnames || {},
        pending: Array.isArray(st0.rpending) ? st0.rpending : [],
        found,
        device
      });
    }
    const st = c.state && typeof c.state === "object" ? c.state : {};
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(c.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    const searching = st.searching === true;
    if (page) {
      const tree = browseView(cfg, { tab: TAB_IDS[0], data: null, recent: [], pending: false, failed: false, searching, device, own: page.view({ ...c, state: st }) || [] });
      const every = page.every ? page.every({ ...c, state: st }) : null;
      return every ? { ...tree, every } : tree;
    }
    return browseView(cfg, { tab, data, recent: meta.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), searching, device });
  }
  function cutShort() {
    try {
      const o = JSON.parse(get(INFLIGHT_KEY) || "null");
      if (!o || typeof o.tab !== "string") return null;
      if (Date.now() - Number(o.at) < INFLIGHT_STALE_MS) return null;
      kino2.storage.remove(INFLIGHT_KEY);
      return o.tab;
    } catch (_) {
      return null;
    }
  }
  async function load(tab) {
    set(INFLIGHT_KEY, JSON.stringify({ tab, at: Date.now() }));
    let page2;
    try {
      page2 = await fromSnapshot(tab) || await loadTab(tab);
    } finally {
      try {
        kino2.storage.remove(INFLIGHT_KEY);
      } catch (_) {
      }
    }
    const data = tabOf(page2);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    async open(ev) {
      if (page) {
        let patch = {};
        try {
          patch = (page.open ? await page.open(ev) : {}) || {};
        } catch (e) {
          log("page open", e && e.code || "error");
        }
        return { state: { ...patch, tab: TAB_IDS[0], pending: [], failed: null } };
      }
      return events.openTabs(ev);
    },
    openTabs({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      set(TAB_KEY, tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      const queued = Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : [];
      return { state: { failed: null, pending: [tab, ...queued] } };
    },
    async tick({ state, route }) {
      if (searchHere && route && route.name === "results") {
        const rp = Array.isArray(state.rpending) ? state.rpending : [];
        if (rp.length === 0) return null;
        const batch = rp.slice(0, SOURCES_PER_TICK);
        const order = Array.isArray(state.rorder) ? state.rorder : [];
        let answers = [];
        try {
          answers = await searchHere.searchIn(String(state.rq || ""), batch);
        } catch (e) {
          log("results", (e && e.code || "error") + " " + String(e && e.message || "").slice(0, 200));
        }
        for (const repo of batch) {
          const a = (Array.isArray(answers) ? answers : []).find((x) => x && x.repo === repo);
          found.set(repo, asFound(a, order.indexOf(repo)));
        }
        return { state: { rpending: rp.slice(SOURCES_PER_TICK) } };
      }
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tab = next.slice(5);
        const m = memo.get(tab);
        if (!m) return { state: { pending: rest } };
        const ask = (x) => ({ id: x.id, title: x.title, kind: x.kind, ...x.year !== void 0 ? { year: x.year } : {} });
        const noOwnSlides = m.data.slides.length === 0;
        const cards = [...m.data.slides.map(ask), ...m.data.rails.flatMap((r) => r.items.slice(0, noOwnSlides ? MAX_SLIDES * 3 : 6).map(ask))].filter((c) => !meta.asked(c.id)).slice(0, META_TICK_CARDS);
        const count = await meta.fill(cards, META_TICK_MS);
        const ticks = (metaTicks.get(tab) || 0) + 1;
        metaTicks.set(tab, ticks);
        const again = noOwnSlides && count > 0 && ticks < MAX_META_TICKS && slidesFromMeta(m.data.rails).length < MAX_SLIDES && cards.some((c) => !meta.asked(c.id));
        return { state: { pending: again ? [next, ...rest] : rest } };
      }
      if (cutShort() === next) {
        log("tab", next, "cut short by Kino last time");
        failed[next] = true;
        return { state: { pending: rest, failed } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The words go to Kino's own search, with this plugin as the source; the bar is put back as it was, locally.
    // The search button's own event (after its local ops): while searching, the tree declares onBack, so Back closes the box.
    searchOpened() {
      return { state: { searching: true } };
    },
    // The box was closed (its arrow, or Back through onBack, already ran the local ops): the flag and the ops go, so the next
    // tree declares no onBack and draws the bar's defaults.
    searchClosed() {
      return { state: { searching: false, ui: null } };
    },
    async search({ value, state, device }) {
      const typed = value && typeof value === "object" ? value.q : value;
      const raw = typed != null && String(typed).trim() !== "" ? typed : state.inputs && state.inputs.q;
      const q = String(raw == null ? "" : raw).trim().slice(0, Q_MAX);
      if (!q) return null;
      const closed = searchClosedOps(device === "tv" && TAB_IDS.length > 1);
      if (searchHere) {
        let sources = [];
        try {
          sources = await searchHere.sources() || [];
        } catch (e) {
          log("sources", e && e.code || "error");
        }
        const order = sources.map((x) => x.repo).filter((r) => typeof r === "string");
        found.clear();
        return { route: { push: "results" }, ui: closed, state: {
          searching: false,
          ui: null,
          rq: q,
          rorder: order,
          rnames: Object.fromEntries(sources.map((x) => [x.repo, String(x.name || x.repo)])),
          rpending: order
        } };
      }
      return { go: { search: { q } }, ui: closed, state: { searching: false, ui: null } };
    },
    openSettings() {
      return { route: { push: "settings" }, state: { fromBrowse: true } };
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { fromBrowse: false } };
    }
  };
  async function screenEvent2(ev) {
    const e = ev || {};
    const name2 = e.name != null ? e.name : e.event;
    const own = page && page.events && typeof name2 === "string" && Object.hasOwn(page.events, name2) && !Object.hasOwn(events, name2) ? page.events[name2] : null;
    if (own) return await own({ ...e, state: e.state || {} }) ?? null;
    const handler = typeof name2 === "string" && name2 !== "openTabs" && Object.hasOwn(events, name2) ? events[name2] : null;
    return handler ? await handler({ ...e, state: e.state || {} }) ?? null : null;
  }
  return { screen: screen2, screenEvent: screenEvent2, notePlayed };
}

// src/logo.js
var LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAMAAADDpiTIAAAB/lBMVEWhX2JgX12k3ejgl5admqJij6BlIibmpmMXmM4dHyWjISMlZZzrz57cZRbk4+ddqM/UY2KdtcoqUmrilSWvao8W4fHWcJ5i4+0kKlayVBlWbpL31XEsUx2hm2fWJh9OYzGYNUhpjW8wiK3uj8Wwyq8QccP30TVwN0mqkDFykDy3wns2hmkELoXje8FFd8j6P0ARCRc6DSf9/f0SChj2AADs5+jQAAEuAQLY1tewAQLNyMqPAQRvAgVPAQLs2dbxibXs2eXtx88Darb15djrt823trZMCyOuqKrIurkEc7zVuMvuqLTW5evrlbYCdsPtt7bQ2eQPSIznlxb98rLQZwuzxtANOHHuqMf655EFFDPRprH1yUz41VTMaJPRmLHupirVdw0SVpL766v52WwVRXEwZ4/wxrKPh4nliBWMKC3Zhg5KeJDQdpELJ07LWAr4xjcEGEuUlpUTNlTytjL3uJHPh5Lqe6vwphjUqcTxmMMHKW6smJcIOog1FTQuV3KPNjUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5l/QKAAAAgHRSTlP///////////////////////////////////////////////////////////////////8A/////////////////////////////////////////////////////////////////////////////////////////////////////y+c/vYAAKozSURBVHja7b2JQ1PX2v+7M0IYQhiUodXa1p7z/oZ7L+QYSHYGEyAkzOARrLGitCgOaIuWVqXqv36/z7PW2nvtIRODgrJP6ww98nz2Mw/Gfz7JM37xtP18GskYF4L/ukEwLmT/dVNgXAj/64bAuBD+1w2BcSH9r5sB40L6XzcDxoX0v24GjAvxf90IGBfS/7oZMC7E/3UjYFyI/+tGwLgQ/9eNgHEh/q8bAeNC/F83AsaF/L9uAowL8X/dCBgX4v+6ETAu5P91E2Bc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";
var LOGO_ASPECT = "1:1";

// src/resolve-door.js
var HLS_MIME = "application/vnd.apple.mpegurl";
var RESOLVER_ALIAS = "resolver";
var CAPTURE_MS = 2e4;
function headersOf(s) {
  const out = {};
  if (s.referer) out.Referer = s.referer;
  const h = s.headers;
  if (Array.isArray(h)) for (const x of h) {
    if (x && x.name) out[x.name] = String(x.value);
  }
  else if (h && typeof h === "object") for (const [k, v] of Object.entries(h)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}
function pickBest(streams) {
  return streams.find((s) => s && s.url && (s.kind === "hls" || /\.m3u8(\?|$)/i.test(s.url))) || streams.find((s) => s && s.url) || null;
}
async function captureStreams(kino2, embedUrl, referer) {
  const b = kino2 && kino2.browser;
  if (!b || typeof b.capture !== "function") return [];
  const opts = { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4|\\.mpd" };
  if (referer) opts.headers = { Referer: referer };
  let cap;
  try {
    cap = await b.capture(embedUrl, opts);
  } catch (_) {
    return [];
  }
  const out = [];
  for (const m of cap && cap.media || []) {
    if (!m || !m.url) continue;
    out.push({ url: m.url, kind: /\.m3u8(\?|$)/i.test(m.url) ? "hls" : "mp4", server: "browser", headers: m.headers || {} });
  }
  return out;
}
async function resolveViaHelper(embedUrl, kino2, referer, allowCapture = true) {
  let res = null;
  try {
    res = await kino2.plugins.call(RESOLVER_ALIAS, "resolve", { url: embedUrl, referer });
  } catch (err) {
    try {
      kino2.log("[mundodonghua]", "resolver", err && err.code || "call_failed");
    } catch (_) {
    }
  }
  let streams = res && Array.isArray(res.streams) ? res.streams.slice() : [];
  const subtitles = res && Array.isArray(res.subtitles) ? res.subtitles.filter((x) => x && x.lang && x.url) : [];
  let captured = false;
  const dead = !streams.length && res && res.error === "dead";
  if (!streams.length && !dead && (typeof allowCapture === "function" ? allowCapture() : allowCapture)) {
    streams = await captureStreams(kino2, embedUrl, referer);
    captured = streams.length > 0;
  }
  const s = pickBest(streams);
  if (!s) return null;
  const headers = headersOf(s);
  const isHls = s.kind === "hls" || /\.m3u8(\?|$)/i.test(s.url);
  return {
    url: s.url,
    mime: isHls ? HLS_MIME : /\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : void 0,
    ...Object.keys(headers).length ? { headers } : {},
    ...captured ? { captured: true } : {},
    ...subtitles.length ? { subtitles } : {}
  };
}
async function resolverInstalled(kino2) {
  try {
    await kino2.plugins.call(RESOLVER_ALIAS, "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (err) {
    return (err && err.code) !== "provider_missing";
  }
}

// src/util/terms.js
function searchTerms(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const out = [];
  const add = (s) => {
    const v = String(s || "").trim();
    if (v.length >= 2 && !out.some((x) => norm(x) === norm(v))) out.push(v);
  };
  add(q);
  if (arg && typeof arg === "object") {
    add(arg.originalTitle);
    for (const a of Array.isArray(arg.altTitles) ? arg.altTitles : []) add(a);
  }
  add(q.split(/\s*[:\-–—]\s*/)[0]);
  return out.slice(0, 4);
}
async function searchWithTerms(arg, one) {
  for (const q of searchTerms(arg)) {
    const found = await one(arg && typeof arg === "object" ? { ...arg, q } : q);
    if (found.length) return found;
  }
  return [];
}

// src/util/home.js
var BUDGET_MS = 11e3;
var KEEP_MS = 12 * 60 * 60 * 1e3;
var MAX_CHARS = 60 * 1024;
function keep(key, rows) {
  try {
    for (let per = 20; per >= 4; per -= 4) {
      const text = JSON.stringify({ at: Date.now(), rows: rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items.slice(0, per) : r.items })) });
      if (text.length <= MAX_CHARS) {
        kino.storage.set(key, text, { ttlMs: KEEP_MS });
        return;
      }
    }
  } catch (_) {
  }
}
function kept(key) {
  try {
    const o = JSON.parse(kino.storage.get(key) || "null");
    return o && Date.now() - o.at < KEEP_MS && Array.isArray(o.rows) && o.rows.length ? o.rows : null;
  } catch (_) {
    return null;
  }
}
async function homeWithin(jobs, { key = "home:last", budgetMs = BUDGET_MS } = {}) {
  const out = jobs.map(() => null);
  let done = false;
  const all = Promise.all(jobs.map((job, i) => Promise.resolve().then(job).then((row) => {
    out[i] = row;
  }, () => {
  }))).then(() => {
    done = true;
  });
  const end = Date.now() + budgetMs;
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  const rows = out.filter(Boolean);
  if (rows.length) {
    keep(key, rows);
    return rows;
  }
  return kept(key) || [];
}

// src/std/catalog.js
var CATALOG_MAX = 40;
var OVERVIEW_MAX2 = 300;
var HTTPS3 = /^https:\/\//;
function catalogItems(found) {
  const out = [];
  const list = Array.isArray(found) ? found : found && Array.isArray(found.items) ? found.items : [];
  for (const it of list) {
    if (out.length >= CATALOG_MAX) break;
    if (!it || typeof it.id !== "string" || !it.id || typeof it.ref !== "string" || !it.ref || typeof it.title !== "string" || !it.title) continue;
    const item = { id: it.id, ref: it.ref, title: it.title, kind: typeof it.kind === "string" && it.kind ? it.kind : "movie" };
    if (typeof it.poster === "string" && HTTPS3.test(it.poster)) item.poster = it.poster;
    if (typeof it.backdrop === "string" && HTTPS3.test(it.backdrop)) item.backdrop = it.backdrop;
    if (it.year !== void 0 && it.year !== null && String(it.year)) item.year = String(it.year);
    if (typeof it.overview === "string" && it.overview.trim()) item.overview = it.overview.trim().slice(0, OVERVIEW_MAX2);
    const tmdb = it.ids && Number.isInteger(it.ids.tmdb) ? it.ids.tmdb : Number.isInteger(it.tmdb) ? it.tmdb : 0;
    if (tmdb > 0) item.tmdb = tmdb;
    out.push(item);
  }
  return out;
}
function catalogQuery(arg) {
  const q = String(arg && arg.q || "").trim().slice(0, 200);
  const type = arg && (arg.type === "movie" || arg.type === "series") ? arg.type : "any";
  return { q, type, season: 0, episode: 0, tmdbId: 0, year: 0, originalTitle: "", altTitles: [], cursor: null };
}
function catalogDoor(search2) {
  return async (arg) => {
    const query = catalogQuery(arg);
    if (!query.q) return [];
    return catalogItems(await search2(query));
  };
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
var CACHE_MS = 10 * 60 * 1e3;
var PAGE = 24;
var RESOLVE_MS = 7e4;
var MAX_CAPTURES = 3;
var CAPTURE_PAGE_MS = 23e3;
function takeCapture(budget) {
  if (!budget || budget.captures <= 0 || budget.deadline - Date.now() < CAPTURE_PAGE_MS) return false;
  budget.captures -= 1;
  return true;
}
var STRINGS = {
  es: {
    news: "Novedades",
    newEpisodes: "Nuevos episodios",
    airing: "En emisi\xF3n",
    finished: "Finalizadas",
    all: "Donghuas",
    movies: "Pel\xEDculas",
    genres: "G\xE9neros",
    series: "Series",
    more: "M\xE1s de",
    ep: "Ep.",
    lat: "Latino",
    esp: "Castellano",
    sub: "Subtitulado",
    episode: "Episodio",
    heroText: "Animaci\xF3n china en espa\xF1ol, con episodios nuevos cada semana.",
    unavailable: "El servicio no est\xE1 disponible en este momento.",
    noEpisodes: "No se encontraron episodios de este donghua.",
    noStreams: "Ning\xFAn servidor de este episodio abri\xF3. Prueba m\xE1s tarde.",
    statusLine: "Listas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada.",
    needResolver: "Para reproducir, abre MundoDonghua desde el men\xFA e instala el motor de reproducci\xF3n que te pedir\xE1."
  },
  en: {
    news: "What's new",
    newEpisodes: "New episodes",
    airing: "Airing",
    finished: "Finished",
    all: "Donghua",
    movies: "Movies",
    genres: "Genres",
    series: "Series",
    more: "More",
    ep: "Ep.",
    lat: "Latino",
    esp: "Castilian",
    sub: "Subtitled",
    episode: "Episode",
    heroText: "Chinese animation in Spanish, with new episodes every week.",
    unavailable: "The service is not available right now.",
    noEpisodes: "No episodes found for this donghua.",
    noStreams: "No server of this episode opened. Try again later.",
    statusLine: "Lists kept: {n}",
    cacheCleared: "Cache cleared.",
    needResolver: "To play, open MundoDonghua from the menu and install the playback engine it asks for."
  }
};
var t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};
async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...headers || {} }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `MundoDonghua ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}
async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) {
  }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v;
  try {
    kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS });
  } catch (_) {
  }
  return v;
}
var genreMemory = /* @__PURE__ */ new Map();
async function genreCards(name) {
  if (genreMemory.has(name)) return genreMemory.get(name);
  const cards = parseCards(await getPage(`${SITE}/genero/${encodeURIComponent(name).replace(/%20/g, "+")}`));
  if (genreMemory.size >= 2) genreMemory.delete(genreMemory.keys().next().value);
  genreMemory.set(name, cards);
  return cards;
}
function audioChoice() {
  try {
    const v = kino.config.get("audio");
    return v === "dub" || v === "sub" ? v : "all";
  } catch (_) {
    return "all";
  }
}
var byAudio = (cards) => {
  const a = audioChoice();
  return a === "all" ? cards : cards.filter((c) => isDubbed(c.title) === (a === "dub"));
};
var fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var hash36 = (s) => {
  let h = 5381;
  for (const ch of String(s)) h = (h * 33 ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
};
var idOf = (slug) => "md-" + (fold(slug).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "dh") + "-" + hash36(slug);
function toItem(card) {
  const movie = /pel[ií]cula/i.test(card.badge || "");
  const dub = isDubbed(card.title);
  const item = {
    lang: dub ? /castellano/i.test(card.title) ? "es-ES" : "es-419" : void 0,
    id: idOf(card.slug),
    ref: (movie ? "m:" : "d:") + encodeURIComponent(card.slug),
    title: card.title.replace(/\s+(latino|castellano)$/i, "").trim() || card.title,
    kind: movie ? "movie" : "series",
    genres: ["Animaci\xF3n"],
    badges: [dub ? /castellano/i.test(card.title) ? t("esp") : t("lat") : t("sub")]
  };
  if (!item.lang) delete item.lang;
  if (card.poster) item.poster = card.poster;
  if (card.episode) item.badges.unshift(`${t("ep")} ${card.episode}`);
  else if (card.badge && !/^donghua$/i.test(card.badge)) item.badges.unshift(card.badge);
  return item;
}
var LISTS = {
  todas: { path: "/lista-donghuas", titleKey: "all", paged: true },
  emision: { path: "/lista-donghuas-emision", titleKey: "airing", paged: true },
  finalizadas: { path: "/lista-donghuas-finalizados", titleKey: "finished", paged: true },
  episodios: { path: "/lista-episodios", titleKey: "newEpisodes", paged: true }
};
function refOf(ref) {
  const m = /^(list|genre):(.+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") return LISTS[m[2]] ? { kind: "list", name: m[2], title: t(LISTS[m[2]].titleKey) } : null;
  let name = m[2];
  try {
    name = decodeURIComponent(m[2]);
  } catch (_) {
  }
  return { kind: "genre", name, title: name };
}
async function listPage(def, page) {
  if (def.kind === "genre") {
    const all = byAudio(await genreCards(def.name));
    const slice = all.slice((page - 1) * PAGE, page * PAGE);
    return { cards: slice, more: all.length > page * PAGE };
  }
  const l = LISTS[def.name];
  const cards = await cached(`${def.name}:${page}`, async () => parseCards(await getPage(SITE + l.path + (page > 1 ? "?page=" + page : ""))));
  return { cards: byAudio(cards), more: cards.length >= PAGE };
}
var safeRow = async (id, fn) => {
  try {
    return await fn();
  } catch (e) {
    kino.log("row " + id + ": " + (e && e.message));
    return null;
  }
};
async function rowOf(id, ref, genre) {
  const def = refOf(ref);
  const { cards } = await listPage(def, 1);
  const items = cards.slice(0, 20).map(toItem);
  return items.length ? { id, title: def.title, items, ref, genre: genre || "anime" } : null;
}
async function home() {
  return homeWithin([
    () => safeRow("episodios", () => rowOf("episodios", "list:episodios")),
    () => safeRow("emision", () => rowOf("emision", "list:emision")),
    () => safeRow("todas", () => rowOf("todas", "list:todas")),
    () => safeRow("peliculas", () => rowOf("peliculas", "genre:Pel\xEDcula", "peliculas"))
  ]);
}
async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map(toItem), next: more ? String(page + 1) : void 0 };
}
async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/busquedas?donghua=${encodeURIComponent(q)}`)));
  const within = typeof arg === "object" && arg && arg.within ? refOf(arg.within) : null;
  const moviePage = within && within.kind === "genre" && /^pel[ií]cula/i.test(within.name);
  const items = byAudio(cards).map((c) => toItem(c));
  return items.filter((i) => !within || i.kind === "movie" === !!moviePage).slice(0, 40);
}
var search = (arg) => searchWithTerms(arg, searchOne);
var SECTION_GENRES = ["Acci\xF3n", "Aventura", "Fantas\xEDa", "Romance", "Comedia", "Cultivaci\xF3n"];
async function section({ tab } = {}) {
  const tabs = [{ id: "novedades", label: t("news") }, { id: "series", label: t("series") }, { id: "generos", label: t("genres") }, { id: "peliculas", label: t("movies") }];
  const chosen = tabs.some((x) => x.id === tab) ? tab : "novedades";
  let rows = [];
  if (chosen === "novedades") rows = await Promise.all([safeRow("episodios", () => rowOf("episodios", "list:episodios")), safeRow("emision", () => rowOf("emision", "list:emision"))]);
  else if (chosen === "series") rows = await Promise.all([safeRow("todas", () => rowOf("todas", "list:todas")), safeRow("finalizadas", () => rowOf("finalizadas", "list:finalizadas"))]);
  else if (chosen === "peliculas") {
    rows = [await safeRow("peliculas", () => rowOf("peliculas", "genre:Pel\xEDcula", "peliculas"))];
    rows.push(await safeRow("peliculas2", async () => {
      const { cards } = await listPage(refOf("genre:Pel\xEDcula"), 2);
      const items = cards.map(toItem);
      return items.length ? { id: "peliculas2", title: `${t("more")} ${t("movies")}`, items, genre: "peliculas" } : null;
    }));
  } else rows = await Promise.all(SECTION_GENRES.map((g) => safeRow("genre-" + g, () => rowOf("genre-" + hash36(g), "genre:" + encodeURIComponent(g)))));
  rows = rows.filter(Boolean);
  const answer = { tabs, tab: chosen, rows };
  const first = rows.flatMap((r) => r.items).find((i) => i.poster);
  if (first) answer.hero = { title: first.title, text: t("heroText"), image: first.poster };
  return answer;
}
async function categories() {
  return GENRES.slice(0, 24).map((g) => ({ id: "g-" + hash36(g), title: g, ref: "genre:" + encodeURIComponent(g) }));
}
async function details(ref) {
  const m = /^[dm]:(.+)$/.exec(String(ref || ""));
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(m[1]);
  } catch (_) {
    return null;
  }
  const show = parseShow(await getPage(`${SITE}/donghua/${encodeURIComponent(slug)}`));
  const out = { overview: show.overview || void 0, genres: show.genres.length ? show.genres : void 0, poster: show.poster };
  for (const k of Object.keys(out)) if (out[k] === void 0) delete out[k];
  return out;
}
async function episodes(ref) {
  const m = /^[dm]:(.+)$/.exec(String(ref || ""));
  let slug = null;
  try {
    slug = m && decodeURIComponent(m[1]);
  } catch (_) {
    slug = null;
  }
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const show = parseShow(await getPage(`${SITE}/donghua/${encodeURIComponent(slug)}`));
  if (!show.episodes.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  const series = { title: show.title.replace(/\s+(latino|castellano)$/i, "").trim() || void 0, poster: show.poster, overview: show.overview || void 0, genres: show.genres.length ? show.genres : void 0 };
  for (const k of Object.keys(series)) if (series[k] === void 0) delete series[k];
  return { series, episodes: show.episodes.map((e) => ({ season: 1, number: e.number, ref: `e:${encodeURIComponent(slug)}:${e.number}`, title: `${t("episode")} ${e.number}` })) };
}
var NAMES = { asura: "Asura", fmoon: "Filemoon", amagi: "VOE", kaga: "VGEmbed", vhide: "VidHide", swish: "StreamWish", sp2p: "StreamP2P" };
var HLS = "application/vnd.apple.mpegurl";
var HLS_MS = 4e3;
var ORDER = ["asura", "vhide", "swish", "amagi", "fmoon", "kaga", "sp2p"];
function plan(servers) {
  const base = (s) => {
    const i = ORDER.indexOf(s.id);
    return i < 0 ? 50 : i;
  };
  let pref = "auto";
  try {
    pref = String(kino.config.get("server") || "auto");
  } catch (_) {
    pref = "auto";
  }
  const rank = (s) => pref !== "auto" && s.id === pref ? -1 : base(s);
  return [...servers].sort((a, b) => rank(a) - rank(b));
}
async function open(server, req, pageUrl, budget) {
  if (server.kind === "hls") {
    const r = await req(server.url, { headers: { Referer: SITE + "/" }, timeoutMs: HLS_MS });
    if (!r.ok || !String(await r.text()).includes("#EXTM3U")) return null;
    return { url: server.url, mime: HLS, headers: { Referer: SITE + "/", Origin: SITE } };
  }
  const out = await resolveViaHelper(server.url, kino, SITE + "/", () => takeCapture(budget));
  return out;
}
var STATS_KEY = "srvStats";
var STATS_CAP = 24;
function readStats() {
  try {
    const o = JSON.parse(kino.storage.get(STATS_KEY) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}
function scoreOf(id, stats) {
  const s = stats[id] || { ok: 0, fail: 0 };
  return (s.ok + 1) / (s.ok + s.fail + 2);
}
function noteServer(id, ok) {
  try {
    const stats = readStats();
    const s = stats[id] || { ok: 0, fail: 0 };
    s[ok ? "ok" : "fail"] += 1;
    if (s.ok + s.fail > STATS_CAP) {
      s.ok = Math.round(s.ok / 2);
      s.fail = Math.round(s.fail / 2);
    }
    stats[id] = s;
    kino.storage.set(STATS_KEY, JSON.stringify(stats));
  } catch (_) {
  }
}
async function resolve(ref) {
  const m = /^(?:e:([^:]+):(\d+)|m:([^:]+)|c:([^:]+):(\d+):(\d+))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled(kino)) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const slugRaw = m[1] || m[3] || m[4];
  const number = Number(m[2] || (m[3] ? 1 : m[5]));
  const only = m[6] != null ? Number(m[6]) : null;
  let slug;
  try {
    slug = decodeURIComponent(slugRaw);
  } catch (_) {
    throw kino.error("not_found", "unknown ref: " + ref);
  }
  const pageUrl = `${SITE}/ver/${encodeURIComponent(slug)}/${number}`;
  const servers = plan(parseServers(await getPage(pageUrl, { Referer: `${SITE}/donghua/${encodeURIComponent(slug)}` })));
  if (!servers.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const budget = { captures: MAX_CAPTURES, deadline: Date.now() + RESOLVE_MS };
  let prefSet = false;
  try {
    prefSet = String(kino.config.get("server") || "auto") !== "auto";
  } catch (_) {
    prefSet = false;
  }
  const stats = readStats();
  const order = only != null ? [only] : prefSet ? servers.map((_, k) => k) : servers.map((_, k) => k).sort((a, b) => scoreOf(servers[b].id, stats) - scoreOf(servers[a].id, stats));
  const failures = [];
  for (const i of order) {
    const s = servers[i];
    if (!s) continue;
    try {
      const out = await open(s, req, pageUrl, budget);
      if (!out) {
        failures.push(`${s.id}: no stream`);
        noteServer(s.id, false);
        continue;
      }
      noteServer(s.id, true);
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: NAMES[s.id] || s.id };
      if (out.subtitles) stream.subtitles = out.subtitles;
      if (out.durationMs) stream.durationMs = out.durationMs;
      if (only == null) {
        const others = servers.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${encodeURIComponent(slug)}:${number}:${j}`, label: NAMES[servers[j].id] || servers[j].id }));
        try {
          standard().notePlayed("d:" + encodeURIComponent(slug));
        } catch (_) {
        }
      }
      return stream;
    } catch (e) {
      failures.push(`${s.id}: ${e && e.code || ""} ${e && e.message || e}`.trim());
      noteServer(s.id, false);
    }
  }
  kino.log(`resolve ${slug}/${number} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t("noStreams") });
}
async function settingsStatus() {
  let n = 0;
  try {
    n = kino.storage.keys().filter((k) => k.startsWith("c:")).length;
  } catch (_) {
  }
  return { info: t("statusLine").replace("{n}", String(n)) };
}
async function action(key) {
  if (key === "clearCache") {
    try {
      for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k);
    } catch (_) {
    }
    genreMemory.clear();
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}
var std = null;
var standard = () => std ?? (std = makeStandardScreen({
  snapshot: "xuper-plugin/kino-plugin-mundodonghua",
  kino,
  name: "MundoDonghua",
  logo: LOGO,
  logoAspect: LOGO_ASPECT,
  needsResolver: true,
  hasSettings: true,
  tabs: [
    { id: "novedades", label: "Novedades", labelEn: "What's new" },
    { id: "series", label: "Series", labelEn: "Series" },
    { id: "generos", label: "G\xE9neros", labelEn: "Genres" },
    { id: "peliculas", label: "Pel\xEDculas", labelEn: "Movies" }
  ],
  loadTab: async (tabId) => ({ rows: (await section({ tab: tabId })).rows })
}));
async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
}
var proto_catalog_search = catalogDoor(search);
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  proto_catalog_search,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus
};
