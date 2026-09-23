# Normativa Uruguay - scrapers

[![Actualizar Constitución](https://github.com/lucasramosuy/normativa-uy/actions/workflows/scrape.yml/badge.svg)](https://github.com/lucasramosuy/normativa-uy/actions/workflows/scrape.yml)
[![Actualizar códigos](https://github.com/lucasramosuy/normativa-uy/actions/workflows/scrape-codigos.yml/badge.svg)](https://github.com/lucasramosuy/normativa-uy/actions/workflows/scrape-codigos.yml)
[![Sitio](https://img.shields.io/website?url=https%3A%2F%2Flucasramosuy.github.io%2Fnormativa-uy%2F&label=sitio)](https://lucasramosuy.github.io/normativa-uy/)

Scrapers de normativa uruguaya desde [IMPO](https://www.impo.com.uy). Esta rama solo genera datos.

## Ramas

| Rama | Contenido |
| --- | --- |
| `main` | Scrapers y sus workflows. Genera `data/*.jsonl` y `reports/`. |
| `api` | Solo los datos publicados. Se actualiza a mano desde `main`. |
| `www` | La web ([lucasramosuy.github.io/normativa-uy](https://lucasramosuy.github.io/normativa-uy/)). Lee `data/` desde `api`. |

## Flujo

1. Correr un scraper: **Actions → Actualizar Constitución desde IMPO** o **Actualizar códigos desde IMPO → Run workflow**. Solo commitea en `main` si cambian las salidas.
2. Revisar el diff en `main`.
3. Publicar: **Actions → Publicar datos en api → Run workflow**. Copia `data/` y `reports/` a `api` y vuelve a desplegar la web.

## Estructura

```
.github/workflows/
  scrape.yml            # Constitución
  scrape-codigos.yml    # códigos listados en scripts/ingest/codigos.json
  publish-api.yml       # main -> api (manual) + redeploy de www
scripts/ingest/         # scrapers (ver scripts/ingest/README.md)
data/                   # un .jsonl por norma, una línea por artículo
reports/                # last_run*.json: cobertura, validación y sha256
requirements-scraper.txt
```

## Formato de `data/*.jsonl`

Una línea JSON por artículo, claves ordenadas.

| Campo | Descripción |
| --- | --- |
| `articulo` | Número de artículo (entero). |
| `articulo_id` | Id textual, incluye sufijos y rangos (`149BIS`, `131144`). Solo códigos. |
| `texto` | Texto del artículo. |
| `documento` | Nombre de la norma. |
| `titulo` | "Artículo N". |
| `titulo_norma`, `libro`, `seccion`, `capitulo` | Ruta de encabezados vigente en IMPO (según la norma). |
| `notas_oficiales` | Notas de IMPO (redacción, derogaciones, referencias). |
| `estado_actual` | Vigencia según IMPO. |
| `fecha_promulgacion`, `fecha_publicacion` | Fechas de la norma. |
| `fecha_scraping` | Momento de la descarga. |
| `hash_contenido` | Hash del contenido del artículo. |
| `url_fuente` | URL oficial en IMPO. |

## Setup local

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements-scraper.txt
python scripts/ingest/scrape_codigos.py --user-agent "normativa-uy-scraper/1.0 (+https://github.com/lucasramosuy/normativa-uy)"
```

## Criterios

- Se consulta `robots.txt` y se respeta el Crawl-Delay (mínimo 10 s).
- User-agent identificado.
- Validación contra el índice oficial de IMPO: sin faltantes, duplicados ni textos vacíos. Si algo no cierra, no se escribe nada.
