# Normativa Uruguay - sitio web

[![Deploy GitHub Pages](https://github.com/lucasramosuy/normativa/actions/workflows/pages.yml/badge.svg?branch=www)](https://github.com/lucasramosuy/normativa/actions/workflows/pages.yml)
[![Sitio](https://img.shields.io/website?url=https%3A%2F%2Flucasramos.uy%2Fnormativa%2F&label=sitio)](https://lucasramos.uy/normativa/)
[![Astro](https://img.shields.io/badge/Astro-static-BC52EE?logo=astro)](https://astro.build/)

Sitio estático en Astro para buscar y leer normativa uruguaya. Se publica en GitHub Pages y se sirve en **https://lucasramos.uy/normativa/** a través de un Worker de Cloudflare.

El repo se llamaba `normativa-uy`; ahora es `lucasramosuy/normativa`. La URL vieja `lucasramosuy.github.io/normativa-uy/` ya no existe (GitHub no redirige Pages).

## Ramas

| Rama | Contenido |
| --- | --- |
| `main` | Scrapers de IMPO y sus workflows. Genera `data/*.jsonl` y `reports/`. |
| `api` | Solo lo publicado: `data/`, `reports/` e `historial/`. Se actualiza a mano desde `main`. |
| `www` | Solo la web. El build lee `data/` e `historial/` desde `api`. |

## Cómo llegan los datos

1. **Revisión semanal de IMPO** (`main`, lunes 06:17 de Montevideo, o a mano) descarga la Constitución, los códigos y las leyes y decretos. Si cambió el contenido, abre un PR contra `main` con el resumen.
2. Se revisa y se mergea el PR.
3. **Publicar datos en api** (`main`, a mano) copia los datos a `api`, actualiza `historial/` y dispara el deploy de `www`.

Los workflows manuales viejos (`scrape.yml`, `scrape-codigos.yml`), que commiteaban directo a `main`, se retiraron: el semanal también se puede correr a mano.

## Qué hay en el sitio

- La Constitución, 12 códigos y las leyes y decretos de `src/data/leyes.json` (208 normas al 28/09/2026; una norma aparece cuando sus datos llegan a `api`, que hoy publica 221 conjuntos de datos). La lista tiene que coincidir con `scripts/ingest/leyes.json` de `main`.
- Buscador (Pagefind), índice por norma y una página por artículo. Un número solo salta al artículo; con 3+ dígitos también lista menciones en el texto.
- Ficha (`/ficha/`): marcá artículos con «+ Ficha», editalos para adaptarlos a clase (los cambios quedan en el navegador) e imprimí o guardá un A4 limpio.
- Citado por: cada artículo enlaza las normas que lo citan, desde las concordancias de IMPO y las citas del texto.
- Mapa de citas (`/mapa-de-citas/`) y Curiosidades (`/curiosidades/`): el grafo incluye todas las normas publicadas, incluso componentes separados y puntos sin citas detectadas; el tamaño indica citas, no importancia jurídica. Curiosidades muestra los récords del corpus.
- Mesa de lectura y citas APA: varios artículos abiertos como pestañas dentro de la app, «citar en APA» por norma/artículo/código y «Mis referencias» para juntar y exportar la lista. Las citas usan promulgación cuando consta; si solo consta publicación, la muestran con esa etiqueta sin confundir ambas fechas.
- Leydle (`/leydle/`): el juego diario de términos jurídicos, repo [`lucasramosuy/leydle`](https://github.com/lucasramosuy/leydle).
- Página 404 propia (`src/pages/404.astro`).
- Contacto: `/normativa/contacto/` redirige al formulario único de `lucasramos.uy/contacto/?tema=normativa` (repo `www`).
- Historial de cambios en cada artículo, página [/cambios/](https://lucasramos.uy/normativa/cambios/) y feed Atom (`/cambios/feed.xml`). Solo cambios publicados. Los artículos que dejan de figurar en IMPO conservan su página con un aviso.
- Explorador interactivo en `/api/probar/` y contrato OpenAPI 3.0.3 en `/api/openapi.json`, ambos estáticos y self-hosted. Las cinco consultas salen del contrato y los slugs se generan con el catálogo publicado. Sin librería de UI adicional ni CDN.
- API estática v1 en `/api/v1/` (`normas.json`, `{norma}.json`, `{norma}/{articulo}.json`, `historial.json`, `historial/{norma}.json`). Documentación: https://lucasramos.uy/normativa/api/

## Worker de Cloudflare (`worker/proxy.js`)

El Worker "proxy" está delante de `lucasramos.uy` y hace esto:

- **Router**: `/normativa/*` se sirve desde `lucasramosuy.github.io/normativa` y `/profe/*` desde `lucasramosuy.github.io/profe`. `/normativa` y `/profe` sin barra redirigen (301) a la versión con barra. Todo lo demás, incluida la portada, va a Cloudflare Pages (repo `www`, `www-7r1.pages.dev`). Las cookies no se reenvían.
- **Ingesta propia**, para que los adblockers no corten eventos:
  - `/normativa/_i/s`: tunnel de Sentry. Solo acepta POST con envelopes de nuestro DSN (org y proyecto fijos).
  - `/normativa/_i/p/*`: reverse proxy de PostHog (`static/` y `array/` a `us-assets.i.posthog.com` con caché, el resto a `us.i.posthog.com`).
- **Caché larga para `/<proyecto>/_astro/*`** (en la práctica, `/normativa/_astro/*`): esos archivos llevan un hash en el nombre y nunca cambian, así que el Worker les pone `Cache-Control: public, max-age=31536000, immutable` y el navegador no los vuelve a pedir.

`worker/proxy.js` es la copia versionada del código desplegado. No se despliega solo: si se cambia, hay que pegarlo en el editor del Worker en Cloudflare (o usar `wrangler`) e implementar.

## Stack

- Astro, Tailwind CSS 4
- Inter Variable y Source Serif 4, self-hosted con Fontsource
- Íconos de [Reicon](https://reicon.dev/)
- Pagefind para búsqueda estática
- Sentry para errores y rendimiento (por el tunnel `/normativa/_i/s`; source maps con `SENTRY_AUTH_TOKEN`)
- PostHog para analítica de producto (por el proxy `/normativa/_i/p`), sin grabaciones de sesión ni encuestas (`disable_session_recording`, `disable_surveys`), perfiles solo para usuarios identificados y persistencia en `localStorage` (sin cookies)

## Configuración en GitHub

| Nombre | Tipo | Uso |
| --- | --- | --- |
| `SITE_URL` | Variable | URL canónica (`https://lucasramos.uy`). |
| `PUBLIC_SENTRY_DSN` | Variable | DSN público de Sentry (tiene valor por defecto en el código). |
| `PUBLIC_POSTHOG_KEY` | Variable | Key pública de PostHog (tiene valor por defecto en el código). |
| `SENTRY_AUTH_TOKEN` | Secret | Subir source maps a Sentry. |

`PUBLIC_POSTHOG_HOST` ya no se usa: PostHog siempre va por el proxy. Si la variable sigue en el repo, se puede borrar.

## Desarrollo

```bash
pnpm install
pnpm run data   # baja data/ e historial/ desde la rama api
pnpm run dev
pnpm run build
```

## Publicación

Cada push a `www`, o cada publicación en `api`, ejecuta el build y publica `dist/`.

## Piloto: En criollo

80 explicaciones: Constitución (37), Ley General de Educación (21), Niñez y Adolescencia (22). Primera tanda de 30 y segunda de 50 derechos y principios, sin completar las normas enteras. Están en `explicaciones/{slug}.jsonl`, separadas de IMPO. El piloto quedó autorizado para publicar después de verificar los textos vigentes y contrastarlos con obras jurídicas. No se atribuye revisión jurídica a Lucas ni a un abogado.

### Política de contenido

Toda explicación futura debe verificarse contra el texto vigente y contrastarse con un libro u obra jurídica antes de publicarse. No publicar una paráfrasis sin ese control. Registrar obra, URL, pasaje, fecha, método y nivel de respaldo por artículo. Distinguir doctrina específica, marco general y reproducción normativa: un anexo de ley no es comentario doctrinal. Si una edición es antigua, la vigencia se controla con IMPO actual. No afirmar revisión jurídica definitiva.

El piloto usa el Manual de derechos humanos de Mariana Blengio Valdés (versión docente Udelar), el estudio de Felipe Rotondo Tornaría sobre el sistema educativo (Revista de Derecho UM, 2009) y la Guía legislativa de Gustavo Daniel Conde (UNICEF/PNUD, 2007). El alcance exacto está en `revision` de cada registro. Constitución 11/30/44 y CNA 1/4/5 tienen respaldo doctrinal limitado; las condiciones exactas se verificaron en IMPO. CNA 8 conserva garantías procesales cotejadas con la norma, sin comentario exhaustivo de la guía.

El build normal muestra solo `estado: aprobado` con responsable y fecha reales. `CRIOLLO_PREVIEW=true` sirve únicamente para inspeccionar borradores localmente. La revisión documental no es asesoramiento jurídico profesional.

El hash incluye texto legal, notas y estado, además de dependencias registradas; si cambian, oculta la explicación hasta nueva revisión. Los hashes no cubren todo cambio de contexto: revisar reformas y remisiones periódicamente. Artículos retirados, sin texto o con derogación no presentan explicación.

`node --test tests/criollo.test.mjs` verifica publicación e invalidación. Lectura HTML estática, sin IA en vivo ni nueva base de datos. Desktop muestra legal/explicación en dos columnas; mobile: texto legal, criollo, acciones/cita, notas. Subrayado inline suave en condiciones jurídicas. El panel no entra al índice legal de Pagefind.

### Tanda 2: 50 derechos y principios
25 de Constitución, 11 de Educación y 14 de Niñez. Comparación por artículo registrada en `revision`, con obra, pasaje, nivel de respaldo y criterio. Se agregan Piñeyro (UNICEF, 2017), Galusso/Saravia (UNICEF/MIDES, 2023) y el Manual para la defensa jurídica de los derechos humanos de la infancia (2012).

El respaldo varía: hay comentario directo, mención breve y marco general. No se atribuye comentario exhaustivo a una fuente que no lo contiene. Las ediciones antiguas no prueban la vigencia; Educación 11, 14 y 72 se cotejan con la redacción reformada en IMPO. Constitución 32 incorpora la excepción de los artículos 231-232; 22 distingue pesquisa secreta de reserva legal de investigación; 37 evita convertir lenguaje antiguo en regla de discriminación. Hay dependencias con hash para estas remisiones y para CNA 21 y Educación 73.

El estado interno `aprobado` significa habilitado para el build después de contraste documental asistido, no aprobación humana ni revisión jurídica profesional. La tanda se prepara en #34, sin merge ni despliegue; Lucas decide el merge.
