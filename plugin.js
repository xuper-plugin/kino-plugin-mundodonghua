var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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

// src/extractors/vidhide.js
var vidhide_exports = {};
__export(vidhide_exports, {
  HOSTS: () => HOSTS,
  extract: () => extract
});

// src/extractors/shared.js
var HLS_MIME = "application/vnd.apple.mpegurl";
function fileM3u8(text, base) {
  const m = /\bfile\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(text || "");
  return m ? absolute(m[1], base) : null;
}
function hlsKey(text, keys, base) {
  for (const k of keys) {
    const m = new RegExp(`["']${k}["']\\s*:\\s*["']([^"']+)["']`).exec(text || "");
    if (m) return absolute(m[1].replace(/\\\//g, "/"), base);
  }
  return null;
}
function absolute(href, base) {
  try {
    return new URL(href, base).href;
  } catch (_) {
    return null;
  }
}
function findIn(html, pick) {
  return pick(html) || pick(unpack(html) || "") || null;
}
function miss(kino2, server, reason) {
  if (kino2 && typeof kino2.log === "function") kino2.log("[mundodonghua]", server, reason);
  return null;
}
async function pageText(req, url, headers, kino2, server) {
  const r = await req(url, { headers });
  return r.ok ? r.text() : miss(kino2, server || "embed", "status " + r.status);
}
var LANG_CODES = [
  [/^(español|espanol|spanish|castellano|latino|spa|esp?)\b/i, "es"],
  [/^(english|inglés|ingles|eng?)\b/i, "en"],
  [/^(portugu[eê]s|portuguese|pt)\b/i, "pt"],
  // never a bare "por": "Por defecto" is not Portuguese
  [/^(fran[cç]ais|french|franc[eé]s|fre|fra|fr)\b/i, "fr"],
  [/^(italiano|italian|ita|it)\b/i, "it"],
  [/^(deutsch|german|alem[aá]n|ger|deu|de)\b/i, "de"]
];
function langCode(label) {
  const s = String(label || "").trim();
  for (const [re, code] of LANG_CODES) if (re.test(s)) return code;
  return null;
}
function captionTracks(text, base) {
  const m = /["']?\btracks["']?\s*:\s*\[([\s\S]*?)\]/.exec(text || "");
  if (!m) return [];
  const out = [];
  for (const [obj] of m[1].matchAll(/\{[^{}]*\}/g)) {
    const field = (k) => (new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']*)["']`).exec(obj) || [])[1] || "";
    const kind = field("kind").toLowerCase();
    if (kind && kind !== "captions" && kind !== "subtitles") continue;
    const file = field("file");
    const format = (/\.(vtt|srt)(?:[?#]|$)/i.exec(file) || [])[1];
    const label = field("label");
    const lang = langCode(label);
    const url = format && lang ? absolute(file, base) : null;
    if (!url || out.some((t2) => t2.url === url)) continue;
    out.push({ lang, url, label, format: format.toLowerCase() });
  }
  return out;
}
function durationMsOf(text) {
  const re = /(?<![-\w])duration["']?\s*:\s*["']?(\d+(?:\.\d+)?)(?![\d.])(?!\s*m?s\b)/g;
  for (const m of String(text || "").matchAll(re)) {
    const ms = Math.round(Number(m[1]) * 1e3);
    if (ms >= 6e4) return ms;
  }
  return null;
}
function pageExtras(html, base) {
  const unpacked = unpack(html) || "";
  const subs = captionTracks(html, base);
  const subtitles = subs.length ? subs : captionTracks(unpacked, base);
  const durationMs = durationMsOf(html) || durationMsOf(unpacked);
  return { ...subtitles.length ? { subtitles } : {}, ...durationMs ? { durationMs } : {} };
}

// src/extractors/vidhide.js
var HOSTS = ["vidhide.com", "vidhidepro.com", "vidhideplus.com", "vidhidefast.com", "dintezuvio.com", "minochinos.com", "filelions.to", "morencius.com"];
async function extract(embedUrl, req, kino2) {
  const u = new URL(embedUrl);
  const html = await pageText(req, embedUrl, { Referer: u.origin + "/" }, kino2, "vidhide");
  if (html == null) return null;
  const url = findIn(html, (t2) => hlsKey(t2, ["hls4", "hls2"], u.origin) || fileM3u8(t2, u.origin));
  if (!url) return miss(kino2, "vidhide", "no playlist in page");
  return { url, mime: HLS_MIME, headers: { Referer: u.origin + "/", Origin: u.origin }, ...pageExtras(html, u.origin) };
}

// src/extractors/streamwish.js
var streamwish_exports = {};
__export(streamwish_exports, {
  HOSTS: () => HOSTS2,
  extract: () => extract2
});

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var REQUEST_MS = 8e3;
var MIN_MS = 1500;
function makeReq(kino2, { deadline }) {
  const req = async (url, opts = {}) => {
    const left = deadline - Date.now();
    if (left < MIN_MS) throw kino2.error("timeout", "no time left for " + new URL(url).hostname);
    return kino2.fetch(url, { headers: { "User-Agent": UA, ...opts.headers || {} }, method: opts.method, body: opts.body, timeoutMs: Math.min(REQUEST_MS, left) });
  };
  req.left = () => Math.max(0, deadline - Date.now());
  return req;
}

// src/extractors/streamwish.js
var HOSTS2 = ["embedwish.com", "hlswish.com", "streamwish.com", "streamwish.to", "strwish.com", "wishembed.com", "filelions.com", "hglink.to", "vibuxer.com"];
async function extract2(embedUrl, req, kino2) {
  const u = new URL(embedUrl);
  if (u.hostname === "hglink.to") u.hostname = "vibuxer.com";
  const referer = u.origin + "/";
  const html = await pageText(req, u.href, { Referer: referer }, kino2, "streamwish");
  if (html == null) return null;
  const url = findIn(html, (t2) => hlsKey(t2, ["hls4", "hls2", "hls3"], u.origin) || fileM3u8(t2, u.origin));
  if (!url) return miss(kino2, "streamwish", "no playlist in page");
  return { url, mime: HLS_MIME, headers: { "User-Agent": UA, Referer: referer }, ...pageExtras(html, u.origin) };
}

// src/extractors/index.js
var TABLE = { vidhide: vidhide_exports, streamwish: streamwish_exports };
function extractorFor(embedUrl) {
  let host;
  try {
    host = new URL(embedUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
  for (const [name, mod] of Object.entries(TABLE)) {
    if (mod.HOSTS.some((h) => host === h || host.endsWith("." + h))) return { name, extract: mod.extract };
  }
  return null;
}
var HOSTS3 = Object.values(TABLE).flatMap((m) => m.HOSTS);

// src/plugin.js
var CACHE_MS = 10 * 60 * 1e3;
var PAGE = 24;
var RESOLVE_MS = 7e4;
var CAPTURE_MS = 2e4;
var MAX_CAPTURES = 3;
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
    cacheCleared: "Cach\xE9 vaciada."
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
    cacheCleared: "Cache cleared."
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
    id: idOf(card.slug),
    ref: (movie ? "m:" : "d:") + encodeURIComponent(card.slug),
    title: card.title.replace(/\s+(latino|castellano)$/i, "").trim() || card.title,
    kind: movie ? "movie" : "series",
    genres: ["Animaci\xF3n"],
    badges: [dub ? /castellano/i.test(card.title) ? t("esp") : t("lat") : t("sub")]
  };
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
  return (await Promise.all([
    safeRow("episodios", () => rowOf("episodios", "list:episodios")),
    safeRow("emision", () => rowOf("emision", "list:emision")),
    safeRow("todas", () => rowOf("todas", "list:todas")),
    safeRow("peliculas", () => rowOf("peliculas", "genre:Pel\xEDcula", "peliculas"))
  ])).filter(Boolean);
}
async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map(toItem), next: more ? String(page + 1) : void 0 };
}
async function search(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/busquedas?donghua=${encodeURIComponent(q)}`)));
  return byAudio(cards).slice(0, 40).map(toItem);
}
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
function plan(servers) {
  const cheap = (s) => s.kind === "hls" ? 0 : extractorFor(s.url) ? 1 : 9;
  return servers.map((s) => ({ ...s, cheap: cheap(s) })).sort((a, b) => a.cheap - b.cheap);
}
async function open(server, req, pageUrl, budget) {
  if (server.kind === "hls") {
    const r = await req(server.url, { headers: { Referer: SITE + "/" } });
    if (!r.ok || !String(await r.text()).includes("#EXTM3U")) return null;
    return { url: server.url, mime: HLS, headers: { Referer: SITE + "/", Origin: SITE } };
  }
  const ex = extractorFor(server.url);
  if (ex) return ex.extract(server.url, req, kino);
  if (!kino.browser || typeof kino.browser.capture !== "function" || budget.captures <= 0) return null;
  budget.captures -= 1;
  const page = await kino.browser.capture(server.url, { timeoutMs: CAPTURE_MS, headers: { Referer: SITE + "/" } });
  const media = page && page.media || [];
  const best = media.find((x) => /m3u8|mpd/i.test(x.url)) || media[0];
  if (!best) return null;
  return { url: best.url, mime: best.mime || (/\.mpd/i.test(best.url) ? "application/dash+xml" : /\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
}
async function resolve(ref) {
  const m = /^(?:e:([^:]+):(\d+)|m:([^:]+)|c:([^:]+):(\d+):(\d+))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
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
  const budget = { captures: MAX_CAPTURES };
  const failures = [];
  for (const i of only != null ? [only] : servers.map((_, k) => k)) {
    const s = servers[i];
    if (!s) continue;
    try {
      const out = await open(s, req, pageUrl, budget);
      if (!out) {
        failures.push(`${s.id}: no stream`);
        continue;
      }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: NAMES[s.id] || s.id };
      if (out.subtitles) stream.subtitles = out.subtitles;
      if (out.durationMs) stream.durationMs = out.durationMs;
      if (only == null) {
        const others = servers.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${encodeURIComponent(slug)}:${number}:${j}`, label: NAMES[servers[j].id] || servers[j].id }));
      }
      return stream;
    } catch (e) {
      failures.push(`${s.id}: ${e && e.code || ""} ${e && e.message || e}`.trim());
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
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  search,
  section,
  settingsStatus
};
