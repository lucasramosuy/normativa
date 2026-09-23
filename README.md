# Normativa Uruguay - sitio web

[![Deploy GitHub Pages](https://github.com/lucasramosuy/normativa-uy/actions/workflows/pages.yml/badge.svg?branch=www)](https://github.com/lucasramosuy/normativa-uy/actions/workflows/pages.yml)
[![Sitio](https://img.shields.io/website?url=https%3A%2F%2Flucasramosuy.github.io%2Fnormativa-uy%2F&label=sitio)](https://lucasramosuy.github.io/normativa-uy/)
[![Astro](https://img.shields.io/badge/Astro-static-BC52EE?logo=astro)](https://astro.build/)

Sitio estático en Astro para buscar y leer normativa uruguaya, publicado en GitHub Pages.

## Ramas

| Rama | Contenido |
| --- | --- |
| `main` | Scrapers de IMPO y sus workflows. Genera `data/*.jsonl` y `reports/`. |
| `api` | Solo los datos publicados (`data/`, `reports/`). Se actualiza a mano desde `main`. |
| `www` | Solo la web. El build lee `data/` desde `api`. |

Publicar datos nuevos: en `main`, **Actions → Publicar datos en api → Run workflow**. Eso copia `data/` y `reports/` a `api` y vuelve a desplegar la web.

## Stack

- Astro, Tailwind CSS 4
- Inter Variable y Source Serif 4, self-hosted con Fontsource
- Íconos de [Reicon](https://reicon.dev/)
- Pagefind para búsqueda estática
- Sentry para errores y rendimiento (source maps con `SENTRY_AUTH_TOKEN` en Actions Secrets)
- PostHog para analítica de producto

## Desarrollo

```bash
npm install
npm run data   # baja data/ desde la rama api
npm run dev
npm run build
```

Las keys públicas de Sentry y PostHog están en `.env.example`; en GitHub se configuran como Variables (`PUBLIC_*`).

## Publicación

Cada push a `www`, o cada publicación en `api`, ejecuta el build y publica `dist/`.
