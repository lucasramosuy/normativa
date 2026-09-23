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

1. **Revisión semanal de IMPO** (`main`, lunes 06:17 de Montevideo, o a mano) descarga la Constitución y los códigos. Si cambió el contenido, abre un PR contra `main` con el resumen.
2. Se revisa y se mergea el PR.
3. **Publicar datos en api** (`main`, a mano) copia los datos a `api`, actualiza `historial/` y dispara el deploy de `www`.

Los workflows manuales viejos (`scrape.yml`, `scrape-codigos.yml`), que commiteaban directo a `main`, se retiraron: el semanal también se puede correr a mano.

## Qué hay en el sitio

- Buscador (Pagefind), índice por norma y una página por artículo.
- Historial de cambios en cada artículo, página [/cambios/](https://lucasramos.uy/normativa/cambios/) y feed Atom (`/cambios/feed.xml`). Solo cambios publicados. Los artículos que dejan de figurar en IMPO conservan su página con un aviso.
- API estática v1 en `/api/v1/` (`normas.json`, `{norma}.json`, `{norma}/{articulo}.json`, `historial.json`, `historial/{norma}.json`). Documentación: https://lucasramos.uy/normativa/api/

## Worker de Cloudflare (`worker/proxy.js`)

El Worker "proxy" (ruta `lucasramos.uy/normativa*`) hace dos cosas:

- **Router**: `/normativa/*` se sirve desde `lucasramosuy.github.io/normativa`. El resto de `lucasramos.uy` sigue yendo al origen.
- **Ingesta propia**, para que los adblockers no corten eventos:
  - `/normativa/_i/s`: tunnel de Sentry. Solo acepta POST con envelopes de nuestro DSN (org y proyecto fijos).
  - `/normativa/_i/p/*`: reverse proxy de PostHog (`static/` y `array/` a `us-assets.i.posthog.com` con caché, el resto a `us.i.posthog.com`).
- **Caché larga para `/normativa/_astro/*`**: esos archivos llevan un hash en el nombre y nunca cambian, así que el Worker les pone `Cache-Control: public, max-age=31536000, immutable` y el navegador no los vuelve a pedir.

`worker/proxy.js` es la copia versionada del código desplegado. No se despliega solo: si se cambia, hay que pegarlo en el editor del Worker en Cloudflare (o usar `wrangler`) e implementar.

## Stack

- Astro, Tailwind CSS 4
- Inter Variable y Source Serif 4, self-hosted con Fontsource
- Íconos de [Reicon](https://reicon.dev/)
- Pagefind para búsqueda estática
- Sentry para errores y rendimiento (por el tunnel `/normativa/_i/s`; source maps con `SENTRY_AUTH_TOKEN`)
- PostHog para analítica de producto (por el proxy `/normativa/_i/p`)

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
npm install
npm run data   # baja data/ e historial/ desde la rama api
npm run dev
npm run build
```

## Publicación

Cada push a `www`, o cada publicación en `api`, ejecuta el build y publica `dist/`.
