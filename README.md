# Normativa Uruguay - sitio web

[![Deploy GitHub Pages](https://github.com/lucasramosuy/normativa-uy/actions/workflows/pages.yml/badge.svg?branch=www)](https://github.com/lucasramosuy/normativa-uy/actions/workflows/pages.yml)
[![Sitio](https://img.shields.io/website?url=https%3A%2F%2Flucasramosuy.github.io%2Fnormativa-uy%2F&label=sitio)](https://lucasramosuy.github.io/normativa-uy/)
[![Astro](https://img.shields.io/badge/Astro-static-BC52EE?logo=astro)](https://astro.build/)

Sitio estático en Astro para buscar y leer normativa uruguaya. La rama `www` publica en GitHub Pages; `main` queda reservada para el scraper.

## Stack

- Astro, Tailwind CSS 4
- Inter Variable y Source Serif 4, self-hosted con Fontsource
- Pagefind para búsqueda estática
- Sentry para errores y rendimiento
- PostHog para analítica de producto

## Desarrollo

```bash
npm install
npm run dev
npm run build
```

Copiá `.env.example` a `.env` para activar Sentry y PostHog. Sin keys, ambas integraciones quedan apagadas.

## Publicación

Cada push a `www` ejecuta el build y publica `dist/`. Para actualizar los datos, primero se valida el scraper en `main` y luego se hace un merge manual de `main` a `www`. No hay sincronización automática.

## Contenido legal pendiente

Antes de publicar Sentry/PostHog con keys reales, reemplazar `[RESPONSABLE A CONFIRMAR]` y `[CONTACTO A CONFIRMAR]` en privacidad, términos y accesibilidad.
