// node --test test/plugin.test.mjs
// Offline: a fake www.mundodonghua.com built from real fragments (test/fixtures), fake players, a stub of the hidden browser and a stub of `kino`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest } from "../sdk/contract.mjs";

const fixture = (n) => readFileSync(new URL("./fixtures/" + n, import.meta.url), "utf8");
const calls = [];
let pages = {};
let logs = [];
let store = new Map();
let lang = "es";
let cfg = {};
let captures = [];
let captureImpl = null;
globalThis.kino = {
  get lang() { return lang; },
  config: { get: (k) => cfg[k] },
  fetch: async (url, opts = {}) => {
    calls.push({ url, opts });
    const p = pages[url];
    const status = p?.status ?? (p ? 200 : 404);
    return { ok: status < 400, status, url, text: () => p?.body ?? "", json: () => JSON.parse(p?.body ?? "{}") };
  },
  storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, String(v)), keys: () => [...store.keys()], remove: (k) => store.delete(k) },
  log: (...a) => logs.push(a.join(" ")),
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
};
const withBrowser = (impl) => { captureImpl = impl; globalThis.kino.browser = { capture: async (url, o) => { captures.push({ url, o }); return captureImpl(url, o); } }; };
const noBrowser = () => { delete globalThis.kino.browser; captureImpl = null; };
const plugin = await import("../plugin.js");
const { extractorFor } = await import("../src/extractors/index.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; cfg = {}; captures = []; noBrowser(); });

const S = "https://www.mundodonghua.com";
const LISTA = fixture("lista.html");
const EPISODIOS = fixture("episodios.html");
const BUSQUEDA = fixture("busqueda.html");
const SERIE = fixture("serie.html");
const EP_OLD = fixture("episodio.html");
const EP_NEW = fixture("episodio-nuevo.html");

const card = (slug, title, badge = "Donghua") => `<div class="md-card"><a href="/donghua/${slug}"><div class="md-card-img"><img src="/thumbs/${slug}.jpg"><span class="md-card-badge">${badge}</span></div><div class="md-card-info"><h5 class="md-card-title">${title}</h5></div></a></div>`;
const grid = (cards) => `<html><body><div class="md-card-grid">${cards.join("")}</div></body></html>`;

test("the manifest passes the kit's contract check and declares the site, every server host and the hidden browser", async () => {
  const text = readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8");
  const m = JSON.parse(text);
  const v = validateManifest(text);
  assert.ok(!v.errors?.length && v.ok !== false, JSON.stringify(v));
  const { HOSTS } = await import("../src/extractors/index.js");
  for (const h of ["www.mundodonghua.com", "bysekoze.com", "voe.sx", "vgembed.com", "vidhidepro.com", "embedwish.com", ...HOSTS]) assert.ok(m.hosts.includes(h), h);
  assert.equal(m.browser, true);
  assert.ok(m.capabilities.includes("download") && m.section && m.theme && m.icon);
});

test("home: the new episodes become their series with an Ep badge; a movie is a movie; Latino and Castellano are marked", async () => {
  pages[S + "/lista-episodios"] = { body: EPISODIOS };
  pages[S + "/lista-donghuas-emision"] = { body: grid([card("a-latino", "Algo Latino"), card("b", "Otro")]) };
  pages[S + "/lista-donghuas"] = { body: LISTA };
  pages[S + "/genero/Pel%C3%ADcula"] = { body: grid([card("peli-1", "Una Pelicula", "Película")]) };
  const rows = await plugin.home();
  assert.deepEqual(rows.map((r) => r.id), ["episodios", "emision", "todas", "peliculas"]);
  const ep = rows[0].items[0];
  assert.equal(ep.title, "Swallowed Star 3", "the sequel's number stays in the title; only 'Episodio N' goes");
  assert.deepEqual(ep.badges, ["Ep. 161", "Subtitulado"]);
  assert.equal(ep.ref, "d:swallowed-star-3");
  assert.match(ep.id, /^[A-Za-z0-9._~-]{1,128}$/);
  assert.equal(rows[1].items[0].title, "Algo", "the Latino tag leaves the title");
  assert.deepEqual(rows[1].items[0].badges, ["Latino"]);
  assert.equal(rows[3].items[0].kind, "movie");
  assert.equal(rows[3].items[0].ref, "m:peli-1");
  assert.equal(rows[3].genre, "peliculas");
});

test("browse: list pages by ?page=n; a genre is one big page that Kino gets in slices of 24, with a next only while there is more", async () => {
  const fifty = Array.from({ length: 50 }, (_, i) => card("g-" + i, "Titulo " + i));
  pages[S + "/genero/Acci%C3%B3n"] = { body: grid(fifty) };
  const p1 = await plugin.browse("genre:" + encodeURIComponent("Acción"), null);
  assert.equal(p1.items.length, 24);
  assert.equal(p1.next, "2");
  const p3 = await plugin.browse("genre:" + encodeURIComponent("Acción"), "3");
  assert.equal(p3.items.length, 2);
  assert.equal(p3.next, undefined);
  assert.equal(calls.filter((c) => c.url.includes("/genero/")).length, 1, "the big page is fetched once");
  pages[S + "/lista-donghuas?page=2"] = { body: grid(Array.from({ length: 24 }, (_, i) => card("l-" + i, "L " + i))) };
  const l = await plugin.browse("list:todas", "2");
  assert.equal(l.items.length, 24);
  assert.equal(l.next, "3");
  assert.deepEqual((await plugin.browse("list:nope", null)).items, []);
});

test("search: the site's own search; the titles on its result pages are in an h5", async () => {
  pages[S + "/busquedas?donghua=swallowed"] = { body: BUSQUEDA };
  const r = await plugin.search("swallowed");
  assert.equal(r.length, 3);
  assert.equal(r[0].title, "Swallowed Star");
  assert.deepEqual(await plugin.search("s"), []);
});

test("settings: only dubbed or only subtitled narrows the lists and the search", async () => {
  pages[S + "/busquedas?donghua=x1"] = { body: grid([card("d1", "Uno Latino"), card("s1", "Dos"), card("d2", "Tres Castellano")]) };
  assert.equal((await plugin.search("x1")).length, 3);
  cfg.audio = "dub";
  assert.deepEqual((await plugin.search("x1")).map((i) => i.ref), ["d:d1", "d:d2"]);
  cfg.audio = "sub";
  assert.deepEqual((await plugin.search("x1")).map((i) => i.ref), ["d:s1"]);
});

test("section: four tabs, the genres tab a row per genre with its Ver más, the hero is the first title with its cover", async () => {
  pages[S + "/lista-episodios"] = { body: EPISODIOS };
  pages[S + "/lista-donghuas-emision"] = { body: LISTA };
  const first = await plugin.section({ tab: null });
  assert.deepEqual(first.tabs.map((x) => x.id), ["novedades", "series", "generos", "peliculas"]);
  assert.equal(first.tab, "novedades");
  assert.equal(first.hero.title, first.rows[0].items[0].title);
  assert.ok(first.hero.image.startsWith("https://www.mundodonghua.com/thumbs/"));
  assert.equal((await plugin.section({ tab: "nope" })).tab, "novedades");
  for (const g of ["Acci%C3%B3n", "Aventura", "Fantas%C3%ADa", "Romance", "Comedia", "Cultivaci%C3%B3n"]) pages[`${S}/genero/${g}`] = { body: LISTA };
  const gen = await plugin.section({ tab: "generos" });
  assert.deepEqual(gen.rows.map((r) => r.title), ["Acción", "Aventura", "Fantasía", "Romance", "Comedia", "Cultivación"]);
  assert.equal(gen.rows[0].ref, "genre:" + encodeURIComponent("Acción"));
});

test("categories: 24 genres of the site, each a paged list", async () => {
  const c = await plugin.categories();
  assert.equal(c.length, 24);
  assert.equal(c[0].title, "Acción");
  assert.ok(c.every((x) => /^g-[a-z0-9]+$/.test(x.id) && x.ref.startsWith("genre:") && x.title.length <= 40));
  assert.equal(new Set(c.map((x) => x.id)).size, 24);
});

test("episodes and details: the series' synopsis, genres and poster, and its episodes in order", async () => {
  pages[`${S}/donghua/1st-kiss`] = { body: SERIE };
  const r = await plugin.episodes("d:1st-kiss");
  assert.equal(r.series.title, "1st Kiss");
  assert.deepEqual(r.series.genres, ["Romance"]);
  assert.ok(r.series.overview.length > 20 && r.series.poster.startsWith("https://"));
  assert.deepEqual(r.episodes.map((e) => [e.season, e.number, e.ref]), [[1, 13, "e:1st-kiss:13"], [1, 14, "e:1st-kiss:14"], [1, 15, "e:1st-kiss:15"], [1, 16, "e:1st-kiss:16"]]);
  const d = await plugin.details("m:1st-kiss");
  assert.deepEqual(d.genres, ["Romance"]);
  assert.ok(d.overview);
  assert.equal(await plugin.details("zz"), null);
  pages[`${S}/donghua/vacio`] = { body: "<html></html>" };
  await assert.rejects(plugin.episodes("d:vacio"), (e) => e.code === "not_found" && /episodios/.test(e.userMessage));
  await assert.rejects(plugin.episodes("zz"), (e) => e.code === "not_found");
});

const OLD_URL = `${S}/ver/1st-kiss/1`;
const NEW_URL = `${S}/ver/jade-dynasty-4/11`;
const hlsPage = "<script>var d={\"hls4\":\"/stream/abc/master.m3u8\"};</script>";

test("resolve: the servers that need no browser come first (VidHide, StreamWish), and the others are lazy copies", async () => {
  pages[NEW_URL] = { body: EP_NEW };
  const servers = (await import("../src/mundodonghua.js")).parseServers(EP_NEW);
  const vhide = servers.find((s) => s.id === "vhide").url;
  pages[vhide] = { body: hlsPage };
  const s = await plugin.resolve("e:jade-dynasty-4:11");
  assert.equal(s.label, "VidHide");
  assert.match(s.url, /master\.m3u8$/);
  assert.equal(s.mime, "application/vnd.apple.mpegurl");
  assert.deepEqual(s.alternatives.map((a) => a.label), ["StreamWish", "Filemoon", "VOE", "StreamP2P"]);
  assert.equal(captures.length, 0, "no hidden browser page was opened");
  pages[servers.find((x) => x.id === "swish").url] = { body: hlsPage };
  const sw = await plugin.resolve(s.alternatives[0].ref);
  assert.equal(sw.label, "StreamWish", "a lazy copy asks only its own server");
  assert.equal(sw.alternatives, undefined);
});

test("resolve: an old episode has only servers that need the hidden browser; its capture gives the stream, with the headers the page carried", async () => {
  pages[OLD_URL] = { body: EP_OLD };
  withBrowser(async (url) => ({ media: [{ url: "https://cdn.example/seg.mp4", headers: { Referer: "https://bysekoze.com/" } }, { url: "https://cdn.example/master.m3u8", headers: { Referer: "https://bysekoze.com/", Origin: "https://bysekoze.com" } }] }));
  const s = await plugin.resolve("e:1st-kiss:1");
  assert.equal(s.url, "https://cdn.example/master.m3u8", "a playlist wins over a file");
  assert.equal(s.mime, "application/vnd.apple.mpegurl");
  assert.equal(s.headers.Origin, "https://bysekoze.com");
  assert.equal(s.label, "Filemoon");
  assert.match(captures[0].url, /^https:\/\/bysekoze\.com\/e\//);
  assert.equal(captures[0].o.headers.Referer, "https://www.mundodonghua.com/");
  assert.ok(captures[0].o.timeoutMs <= 25000);
  assert.ok(s.alternatives.length >= 2);
});

test("resolve: at most three hidden-browser pages per resolve, a failed capture falls through, and no browser at all is a sentence for the person", async () => {
  pages[OLD_URL] = { body: EP_OLD };
  withBrowser(async () => { throw Object.assign(new Error("the page asks to confirm a human is there"), { code: "blocked" }); });
  await assert.rejects(plugin.resolve("e:1st-kiss:1"), (e) => e.code === "not_found" && /Ningún servidor/.test(e.userMessage));
  assert.ok(captures.length <= 3, "capped at three: " + captures.length);
  assert.ok(logs.some((l) => /blocked/.test(l)));
  noBrowser();
  captures = [];
  await assert.rejects(plugin.resolve("e:1st-kiss:1"), (e) => e.code === "not_found");
  assert.equal(captures.length, 0);
});

test("resolve: Asura's playlist is used when it answers; a movie is its episode 1; bad refs are errors", async () => {
  pages[OLD_URL] = { body: EP_OLD };
  const asura = (await import("../src/mundodonghua.js")).parseServers(EP_OLD).find((s) => s.id === "asura").url;
  pages[asura] = { body: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nx.m3u8" };
  const s = await plugin.resolve("e:1st-kiss:1");
  assert.equal(s.label, "Asura");
  assert.equal(s.url, asura);
  assert.equal(s.headers.Referer, S + "/");
  pages[`${S}/ver/peli-1/1`] = { body: EP_OLD };
  assert.equal((await plugin.resolve("m:peli-1")).label, "Asura");
  await assert.rejects(plugin.resolve("x:1"), (e) => e.code === "not_found");
  await assert.rejects(plugin.resolve("e:no-existe:3"), (e) => e.code === "unavailable");
  assert.equal(extractorFor("https://voe.sx/e/1"), null);
  assert.equal(extractorFor("https://embedwish.com/e/1").name, "streamwish");
  assert.equal(extractorFor("https://vidhidepro.com/v/1").name, "vidhide");
});

test("settings: the status line counts the lists kept and the action clears them, in both languages", async () => {
  pages[S + "/busquedas?donghua=swallowed"] = { body: BUSQUEDA };
  await plugin.search("swallowed");
  assert.match((await plugin.settingsStatus()).info, /Listas guardadas: 1/);
  lang = "en";
  assert.match((await plugin.settingsStatus()).info, /Lists kept: 1/);
  assert.equal((await plugin.action("clearCache")).message, "Cache cleared.");
  assert.equal(store.size, 0);
});
