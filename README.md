# Normativa UY - sitio web

Esta rama (`www`) contiene el sitio estático de prueba para consultar la Constitución de la República Oriental del Uruguay.

## Sitio

La interfaz usa Tailwind CSS y carga `data/constitucion.jsonl` en el navegador. Permite:

- buscar por número de artículo, texto, título, sección, capítulo y notas;
- abrir enlaces directos con el formato `#articulo-N`;
- navegar entre artículos;
- consultar la fuente oficial de cada artículo en IMPO.

No requiere compilación ni dependencias locales. Para probarlo, serví la raíz del repositorio por HTTP, por ejemplo:

```bash
python -m http.server 8000
```

Luego abrí `http://localhost:8000`.

## Publicación

GitHub Pages se despliega exclusivamente desde esta rama mediante `.github/workflows/pages.yml`. El workflow corre con cada push a `www` o manualmente desde Actions.

En **Settings → Pages**, la fuente debe ser **GitHub Actions**. La URL prevista es:

https://lucasramosuy.github.io/normativa-uy/

## Actualización de datos

La rama `main` queda reservada para el scraper y genera `data/constitucion.jsonl` y `reports/last_run.json`.

La actualización de la web es deliberadamente manual. Cuando se quiera publicar información nueva:

1. ejecutar y validar el scraper en `main`;
2. incorporar `main` en `www` mediante un merge revisado;
3. resolver cualquier conflicto conservando los archivos propios del sitio (`index.html`, `app.js`, este README y el workflow de Pages);
4. hacer push a `www`.

Ese push dispara el despliegue. No hay sincronización automática desde `main` hacia `www`.

## Fuente

Los textos y enlaces del dataset provienen de [IMPO](https://www.impo.com.uy/bases/constitucion/1967-1967), Centro de Información Oficial de Uruguay.
