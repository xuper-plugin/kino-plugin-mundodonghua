# Changelog

## 0.1.4

- Search inside a "Ver más" page (`scopedSearch`: the movies page keeps movies, the others keep series), the audio language on each title (`lang`) and `telemetry`.
  / Búsqueda dentro de una página «Ver más», el idioma de audio en cada título y `telemetry`.

## 0.1.3

- Declares `callistanise.com` (where VidHide redirects) so Kino no longer interrupts the episode with a permission question.
  / Declara `callistanise.com` (adonde redirige VidHide): Kino ya no interrumpe el episodio con una pregunta de permiso.

## 0.1.2

- Declares `mdplayer.xyz` (the Asura server's host) so Kino no longer asks to allow it in the middle of an episode.
  / Declara `mdplayer.xyz` (host del servidor Asura): Kino ya no pide permiso a mitad de un episodio.

## 0.1.1

- Settings: **Preferred server** (automatic, VidHide, StreamWish, Filemoon, VOE, StreamP2P or Asura): the one chosen is tried first and the rest follow.
  / Ajustes: **servidor preferido**; se prueba primero y, si falla, los demás.

## 0.1.0

- First version, built on Kino's plugin API from the start: **Home rows** (new episodes, airing, all, movies), a **section of its own**
  ("Donghua", tabs novedades, series, géneros, películas, a hero with the first cover), **categories** (24 of the site's 45 genres, each a
  paged list), **search**, **seasons and episodes**, a **page of its own** for a show (`details`), a **settings form** (show only dubbed or
  only subtitled, status, clear the cache), a magenta **theme**, the **download** capability and English texts. Needs Kino 0.9.55.
  Servers: VidHidePro and EmbedWish (StreamWish) with plain requests; Asura (a playlist address) with one request; Filemoon/ByseSX, VOE and
  StreamP2P through the hidden browser (`kino.browser.capture`, at most three pages per resolve), which only works in the app.
  / Primera versión, con la API de Kino desde el principio: filas de Inicio, sección propia, categorías por género, búsqueda,
  temporadas y capítulos, ficha propia, ajustes, tema magenta, descargas y textos en inglés. Servidores: VidHidePro y EmbedWish sin
  navegador; Asura con una petición; Filemoon, VOE y StreamP2P con el navegador oculto.
