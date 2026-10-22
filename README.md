# MundoDonghua para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) para ver **donghua** (animación china) en español de
[mundodonghua.com](https://www.mundodonghua.com/): latino, castellano o subtitulado.

> Plugin no oficial. El catálogo y los videos pertenecen a mundodonghua.com y a los servidores donde están alojados; este plugin solo los
> lista y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-mundodonghua
```

Kino pide dos permisos en rojo: *abrir páginas web ocultas para encontrar el video* y *reproducir video desde cualquier servidor que
indique*. Hacen falta porque algunos servidores del sitio (Filemoon, VOE, StreamP2P) arman su dirección con JavaScript.

## Qué trae

- **Una sección propia** («Donghua») con cuatro pestañas —*Novedades*, *Series*, *Géneros* y *Películas*— y un destacado con la primera carátula.
- **Inicio** con *Nuevos episodios*, *En emisión*, *Donghuas* y *Películas*, cada fila con «Ver más» y páginas.
- **Categorías**: 24 de los 45 géneros del sitio (Acción, Artes Marciales, Cultivación, Fantasía, Romance…), cada uno con su lista por páginas.
- **Búsqueda** por título, **ficha** con sinopsis y géneros, **temporadas y episodios**, y **descarga**.
- **Ajustes ▸ MundoDonghua**: mostrar todo, solo doblados (latino o castellano) o solo subtitulados, y vaciar la caché.
- Las carátulas son las del propio sitio, y el icono es su logo (la mascota de Mundo Donghua).

## Servidores

Cada episodio ofrece hasta cinco servidores, y Kino abre el primero que funcione y deja los demás en el menú **Servidor**:

| Servidor | Cómo se abre |
| --- | --- |
| VidHidePro y EmbedWish (StreamWish) | peticiones normales, sin navegador |
| Asura | una petición a su lista de reproducción |
| Filemoon/ByseSX, VOE y StreamP2P | el navegador oculto de Kino (`kino.browser`), como mucho tres páginas por episodio |

Los episodios recientes traen VidHidePro y EmbedWish; los antiguos suelen tener solo Filemoon/VOE/VGEmbed, que necesitan el navegador.
El navegador oculto solo funciona dentro de la app, no en el kit de Node, y nunca resuelve una verificación humana: si un servidor la pide
(VOE a veces), se salta.

## Límites

- Asura (`mdnemonicplayer.xyz`) está caído hoy (Cloudflare responde 522) y varios enlaces de VOE y VGEmbed ya no existen: el plugin los intenta
  y pasa al siguiente.
- Cada género es una página enorme del sitio (hasta 430 KB); se pide una vez y se reparte en páginas de 24.

## Desarrollo

```
npm test            # pruebas sin red
npm run validate    # compila plugin.js y valida el manifiesto con el kit
node sdk/run.mjs ./plugin.js home
node sdk/run.mjs ./plugin.js resolve 'e:renegade-immortal:163'
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
