// MundoDonghua (www.mundodonghua.com): Chinese animation (donghua) in Spanish. Pages: /lista-donghuas (all, 24 a page with ?page=n),
// /lista-donghuas-emision, /lista-donghuas-finalizados, /lista-donghuas-recopilados, /lista-episodios (the newest episodes), /genero/<name> (every
// title of a genre in one page), /busquedas?donghua=<text>, /donghua/<slug> (a series: details and its episodes) and /ver/<slug>/<n> (an
// episode, whose servers sit in packed scripts, one tab each).

import { unpack } from "./util/unpack.js";

export const SITE = "https://www.mundodonghua.com";

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&#8217;/g, "’").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const abs = (u) => { try { return new URL(decode(u), SITE + "/").href; } catch (_) { return undefined; } };

/** The genres of the site's menu: the name it writes in the address. */
export const GENRES = ["Acción", "Artes Marciales", "Aventura", "Ciencia Ficción", "Comedia", "Cultivación", "Demonios", "Drama", "Ecchi", "Escolar", "Fantasía", "Harem",
  "Historico", "Magia", "Mechas", "Misterio", "Mitología", "Música", "Psicológico", "Reencarnación", "Romance", "Seinen", "Shonen", "Sobrenatural", "Superpoderes", "Suspenso",
  "Terror", "Vampiros", "Venganza", "Viaje a Otro Mundo", "Videojuegos", "Zombis"];

/** The slug of a `/donghua/<slug>` address, or null. */
export const slugOf = (href) => { const m = /\/donghua\/([^/?#"]+)/.exec(String(href || "")); if (!m) return null; try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; } };

/** Whether the site says a title is dubbed (Latino or Castellano in its name) or subtitled. */
export const isDubbed = (title) => /\b(latino|castellano)\b/i.test(String(title || ""));

/**
 * The cards of a list, a search or a genre page: `{ slug, title, poster, badge, episode? }`. A card of the newest-episodes list links to
 * /ver/<slug>/<n> and carries `episode`; every other links to /donghua/<slug>. `badge` is "Donghua", "Película", "OVA"...
 */
export function parseCards(html) {
  const out = [];
  const seen = new Set();
  for (const block of String(html || "").split(/<div class="md-card">/).slice(1)) {
    const href = (/<a\b[^>]*\bhref="([^"]+)"/.exec(block) || [])[1] || "";
    const ver = /\/ver\/([^/?#"]+)\/(\d+)/.exec(href);
    const slugRaw = ver ? ver[1] : (/\/donghua\/([^/?#"]+)/.exec(href) || [])[1];
    if (!slugRaw) continue;
    let slug = slugRaw; try { slug = decodeURIComponent(slugRaw); } catch (_) { /* keep */ }
    const raw = strip((/<h[1-6][^>]*class="md-card-title"[^>]*>([\s\S]*?)<\/h[1-6]>/.exec(block) || [])[1]);
    if (!raw || seen.has(slug)) continue;
    seen.add(slug);
    const img = (/<img\b[^>]*\bsrc="([^"]+)"/.exec(block) || [])[1];
    const badge = strip((/<span class="md-card-badge[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(block) || [])[1]);
    const card = { slug, title: ver ? raw.replace(/\s+Episodio\s+\d+\s*$/i, "").trim() || raw : raw, poster: img ? abs(img) : undefined, badge };
    if (ver) card.episode = Number(ver[2]);
    out.push(card);
  }
  return out;
}

/** A series page: `{ title, overview, poster, genres, status, type, episodes: [{ number, href }] }` (episodes ascending). */
export function parseShow(html) {
  const s = String(html || "");
  const g = (re) => strip((re.exec(s) || [])[1]);
  const poster = (/<div class="md-detail-poster"[\s\S]*?<img[^>]*\bsrc="([^"]+)"/.exec(s) || /property="og:image"[^>]*content="([^"]+)"/.exec(s) || [])[1];
  const badge = g(/<span class="md-card-badge md-badge-static[^"]*"[^>]*>([\s\S]*?)<\/span>/);
  const episodes = [];
  const seen = new Set();
  for (const m of s.matchAll(/<li class="md-episode-item[^"]*"[^>]*>\s*<a\b[^>]*\bhref="(\/ver\/[^"]+\/(\d+))"/g)) {
    const n = Number(m[2]);
    if (seen.has(n)) continue;
    seen.add(n);
    episodes.push({ number: n, href: m[1] });
  }
  episodes.sort((a, b) => a.number - b.number);
  return {
    title: g(/class="md-detail-title"[^>]*>([\s\S]*?)<\//),
    overview: g(/class="md-detail-synopsis"[^>]*>([\s\S]*?)<\/(?:p|div)>/),
    poster: poster ? abs(poster) : undefined,
    genres: [...s.matchAll(/class="md-genre-tag"[^>]*>([\s\S]*?)<\//g)].map((m) => strip(m[1])).filter(Boolean).slice(0, 6),
    status: g(/class="md-emision-badge"[^>]*>([\s\S]*?)<\//),
    type: badge,
    episodes,
  };
}

/**
 * The servers of an episode page: `[{ id, kind: "iframe" | "hls", url }]` in the order the page lists them. Each lives in a packed script that
 * wires a tab (`$("#fmoon_tab").click(...)`) to an iframe it appends, or (for `asura`) to a JW Player playlist address.
 */
export function parseServers(html) {
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
