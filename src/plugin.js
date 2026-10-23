// @ts-check
// Kino plugin: MundoDonghua -- Chinese animation (donghua) in Spanish from www.mundodonghua.com.
// Home rows, a section of its own, categories (the site's genres), search, details and episodes come from the site, whose images load for
// Kino (the covers are its own). An episode lists up to five servers: VidHidePro and EmbedWish are opened with plain requests (./extractors),
// Asura (a playlist address) with one request, and Filemoon/ByseSX, VOE and StreamP2P need a page to run, so they go through the hidden
// browser (`kino.browser.capture`), which only exists inside `resolve` and only in the app.

import { SITE, GENRES, isDubbed, parseCards, parseShow, parseServers } from "./mundodonghua.js";
import { extractorFor } from "./extractors/index.js";
import { makeReq, UA } from "./util/http.js";
import { searchWithTerms } from "./util/terms.js";

const CACHE_MS = 10 * 60 * 1000;
const PAGE = 24;
const RESOLVE_MS = 70000;
const CAPTURE_MS = 20000;
const MAX_CAPTURES = 3;

// ---- i18n ----

const STRINGS = {
  es: {
    news: "Novedades", newEpisodes: "Nuevos episodios", airing: "En emisión", finished: "Finalizadas", all: "Donghuas", movies: "Películas", genres: "Géneros", series: "Series", more: "Más de",
    ep: "Ep.", lat: "Latino", esp: "Castellano", sub: "Subtitulado", episode: "Episodio", heroText: "Animación china en español, con episodios nuevos cada semana.",
    unavailable: "El servicio no está disponible en este momento.", noEpisodes: "No se encontraron episodios de este donghua.", noStreams: "Ningún servidor de este episodio abrió. Prueba más tarde.",
    statusLine: "Listas guardadas: {n}", cacheCleared: "Caché vaciada.",
  },
  en: {
    news: "What's new", newEpisodes: "New episodes", airing: "Airing", finished: "Finished", all: "Donghua", movies: "Movies", genres: "Genres", series: "Series", more: "More",
    ep: "Ep.", lat: "Latino", esp: "Castilian", sub: "Subtitled", episode: "Episode", heroText: "Chinese animation in Spanish, with new episodes every week.",
    unavailable: "The service is not available right now.", noEpisodes: "No episodes found for this donghua.", noStreams: "No server of this episode opened. Try again later.",
    statusLine: "Lists kept: {n}", cacheCleared: "Cache cleared.",
  },
};
const t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};

// ---- helpers ----

async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...(headers || {}) }, timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", `MundoDonghua ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}

async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) { /* no cache */ }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v; // an empty answer may be a throttle or a hiccup: not kept
  try { kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS }); } catch (_) { /* a full storage only costs a refetch */ }
  return v;
}

/** A genre page lists every title of the genre at once (hundreds): kept in memory for the next page of the same genre, not in storage. */
const genreMemory = new Map();
async function genreCards(name) {
  if (genreMemory.has(name)) return genreMemory.get(name);
  const cards = parseCards(await getPage(`${SITE}/genero/${encodeURIComponent(name).replace(/%20/g, "+")}`));
  if (genreMemory.size >= 2) genreMemory.delete(genreMemory.keys().next().value);
  genreMemory.set(name, cards);
  return cards;
}

/** What the person chose in Ajustes ▸ MundoDonghua to show: everything, only what is dubbed (Latino, Castellano) or only what is subtitled. */
function audioChoice() {
  try { const v = kino.config.get("audio"); return v === "dub" || v === "sub" ? v : "all"; } catch (_) { return "all"; }
}
const byAudio = (cards) => { const a = audioChoice(); return a === "all" ? cards : cards.filter((c) => isDubbed(c.title) === (a === "dub")); };

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hash36 = (s) => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };
const idOf = (slug) => "md-" + (fold(slug).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "dh") + "-" + hash36(slug);

function toItem(card) {
  const movie = /pel[ií]cula/i.test(card.badge || "");
  const dub = isDubbed(card.title);
  const item = {
    lang: dub ? (/castellano/i.test(card.title) ? "es-ES" : "es-419") : undefined,
    id: idOf(card.slug), ref: (movie ? "m:" : "d:") + encodeURIComponent(card.slug), title: card.title.replace(/\s+(latino|castellano)$/i, "").trim() || card.title,
    kind: movie ? "movie" : "series", genres: ["Animación"], badges: [dub ? (/castellano/i.test(card.title) ? t("esp") : t("lat")) : t("sub")],
  };
  if (!item.lang) delete item.lang;
  if (card.poster) item.poster = card.poster;
  if (card.episode) item.badges.unshift(`${t("ep")} ${card.episode}`);
  else if (card.badge && !/^donghua$/i.test(card.badge)) item.badges.unshift(card.badge);
  return item;
}

// ---- the lists ----

const LISTS = {
  todas: { path: "/lista-donghuas", titleKey: "all", paged: true },
  emision: { path: "/lista-donghuas-emision", titleKey: "airing", paged: true },
  finalizadas: { path: "/lista-donghuas-finalizados", titleKey: "finished", paged: true },
  episodios: { path: "/lista-episodios", titleKey: "newEpisodes", paged: true },
};

/** `{ name, title }` for a browse ref ("list:<name>" or "genre:<name>"); null for anything else. */
function refOf(ref) {
  const m = /^(list|genre):(.+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") return LISTS[m[2]] ? { kind: "list", name: m[2], title: t(LISTS[m[2]].titleKey) } : null;
  let name = m[2]; try { name = decodeURIComponent(m[2]); } catch (_) { /* keep */ }
  return { kind: "genre", name, title: name };
}

/** One page (from 1) of a list or genre: the cards, and whether there may be a next page. */
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

const safeRow = async (id, fn) => { try { return await fn(); } catch (e) { kino.log("row " + id + ": " + (e && e.message)); return null; } };

async function rowOf(id, ref, genre) {
  const def = refOf(ref);
  const { cards } = await listPage(def, 1);
  const items = cards.slice(0, 20).map(toItem);
  return items.length ? { id, title: def.title, items, ref, genre: genre || "anime" } : null;
}

// ---- exports ----

export async function home() {
  return (await Promise.all([
    safeRow("episodios", () => rowOf("episodios", "list:episodios")),
    safeRow("emision", () => rowOf("emision", "list:emision")),
    safeRow("todas", () => rowOf("todas", "list:todas")),
    safeRow("peliculas", () => rowOf("peliculas", "genre:Película", "peliculas")),
  ])).filter(Boolean);
}

export async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map(toItem), next: more ? String(page + 1) : undefined };
}

async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/busquedas?donghua=${encodeURIComponent(q)}`)));
  // inside a "Ver más" page: the movies page (genre Película) keeps movies, any other page keeps the series
  const within = typeof arg === "object" && arg && arg.within ? refOf(arg.within) : null;
  const moviePage = within && within.kind === "genre" && /^pel[ií]cula/i.test(within.name);
  const items = byAudio(cards).map((c) => toItem(c));
  return items.filter((i) => !within || (i.kind === "movie") === !!moviePage).slice(0, 40);
}

export const search = (arg) => searchWithTerms(arg, searchOne);

// ---- the plugin's own section, categories and details ----

const SECTION_GENRES = ["Acción", "Aventura", "Fantasía", "Romance", "Comedia", "Cultivación"];

export async function section({ tab } = {}) {
  const tabs = [{ id: "novedades", label: t("news") }, { id: "series", label: t("series") }, { id: "generos", label: t("genres") }, { id: "peliculas", label: t("movies") }];
  const chosen = tabs.some((x) => x.id === tab) ? tab : "novedades";
  let rows = [];
  if (chosen === "novedades") rows = await Promise.all([safeRow("episodios", () => rowOf("episodios", "list:episodios")), safeRow("emision", () => rowOf("emision", "list:emision"))]);
  else if (chosen === "series") rows = await Promise.all([safeRow("todas", () => rowOf("todas", "list:todas")), safeRow("finalizadas", () => rowOf("finalizadas", "list:finalizadas"))]);
  else if (chosen === "peliculas") {
    rows = [await safeRow("peliculas", () => rowOf("peliculas", "genre:Película", "peliculas"))];
    rows.push(await safeRow("peliculas2", async () => {
      const { cards } = await listPage(refOf("genre:Película"), 2);
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

export async function categories() {
  return GENRES.slice(0, 24).map((g) => ({ id: "g-" + hash36(g), title: g, ref: "genre:" + encodeURIComponent(g) }));
}

/** A show's own page: synopsis, genres and its type, from the site. */
export async function details(ref) {
  const m = /^[dm]:(.+)$/.exec(String(ref || ""));
  if (!m) return null;
  let slug = m[1]; try { slug = decodeURIComponent(m[1]); } catch (_) { return null; }
  const show = parseShow(await getPage(`${SITE}/donghua/${encodeURIComponent(slug)}`));
  const out = { overview: show.overview || undefined, genres: show.genres.length ? show.genres : undefined, poster: show.poster };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export async function episodes(ref) {
  const m = /^[dm]:(.+)$/.exec(String(ref || ""));
  let slug = null;
  try { slug = m && decodeURIComponent(m[1]); } catch (_) { slug = null; }
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const show = parseShow(await getPage(`${SITE}/donghua/${encodeURIComponent(slug)}`));
  if (!show.episodes.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  const series = { title: show.title.replace(/\s+(latino|castellano)$/i, "").trim() || undefined, poster: show.poster, overview: show.overview || undefined, genres: show.genres.length ? show.genres : undefined };
  for (const k of Object.keys(series)) if (series[k] === undefined) delete series[k];
  return { series, episodes: show.episodes.map((e) => ({ season: 1, number: e.number, ref: `e:${encodeURIComponent(slug)}:${e.number}`, title: `${t("episode")} ${e.number}` })) };
}

// ---- resolve ----

const NAMES = { asura: "Asura", fmoon: "Filemoon", amagi: "VOE", kaga: "VGEmbed", vhide: "VidHide", swish: "StreamWish", sp2p: "StreamP2P" };
const HLS = "application/vnd.apple.mpegurl";

/** The servers of an episode in the order to try them: the ones opened with plain requests first (cheap and not tied to the app), then the browser ones. */
function plan(servers) {
  const cheap = (s) => (s.kind === "hls" ? 0 : extractorFor(s.url) ? 1 : 9);
  // Ajustes ▸ MundoDonghua ▸ Servidor preferido: that one first, whatever it costs; the rest in the usual order
  let pref = "auto";
  try { pref = String(kino.config.get("server") || "auto"); } catch (_) { pref = "auto"; }
  const rank = (s) => (pref !== "auto" && s.id === pref ? -1 : cheap(s));
  return servers.map((s) => ({ ...s, cheap: cheap(s) })).sort((a, b) => rank(a) - rank(b));
}

/** One server's stream, or null; `budget.captures` counts the hidden-browser pages left for this resolve. */
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
  const media = (page && page.media) || [];
  const best = media.find((x) => /m3u8|mpd/i.test(x.url)) || media[0];
  if (!best) return null;
  return { url: best.url, mime: best.mime || (/\.mpd/i.test(best.url) ? "application/dash+xml" : /\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
}

/** `ref` is an episode ("e:<slug>:<n>"), a movie ("m:<slug>", its first episode) or one of an episode's other servers ("c:<slug>:<n>:<i>"). */
export async function resolve(ref) {
  const m = /^(?:e:([^:]+):(\d+)|m:([^:]+)|c:([^:]+):(\d+):(\d+))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const slugRaw = m[1] || m[3] || m[4];
  const number = Number(m[2] || (m[3] ? 1 : m[5]));
  const only = m[6] != null ? Number(m[6]) : null;
  let slug; try { slug = decodeURIComponent(slugRaw); } catch (_) { throw kino.error("not_found", "unknown ref: " + ref); }
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
      if (!out) { failures.push(`${s.id}: no stream`); continue; }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...(out.headers || {}) }, label: NAMES[s.id] || s.id };
      if (out.subtitles) stream.subtitles = out.subtitles;
      if (out.durationMs) stream.durationMs = out.durationMs;
      if (only == null) {
        const others = servers.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${encodeURIComponent(slug)}:${number}:${j}`, label: NAMES[servers[j].id] || servers[j].id }));
      }
      return stream;
    } catch (e) {
      failures.push(`${s.id}: ${(e && e.code) || ""} ${(e && e.message) || e}`.trim());
    }
  }
  kino.log(`resolve ${slug}/${number} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t("noStreams") });
}

// ---- Ajustes ▸ MundoDonghua ----

export async function settingsStatus() {
  let n = 0;
  try { n = kino.storage.keys().filter((k) => k.startsWith("c:")).length; } catch (_) { /* no storage */ }
  return { info: t("statusLine").replace("{n}", String(n)) };
}

export async function action(key) {
  if (key === "clearCache") {
    try { for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k); } catch (_) { /* nothing to clear */ }
    genreMemory.clear();
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}
