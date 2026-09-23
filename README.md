# Normativa Uruguay - scrapers

[![Revisión semanal de IMPO](https://github.com/lucasramosuy/normativa/actions/workflows/scrape-semanal.yml/badge.svg)](https://github.com/lucasramosuy/normativa/actions/workflows/scrape-semanal.yml)
[![Sitio](https://img.shields.io/website?url=https%3A%2F%2Flucasramos.uy%2Fnormativa%2F&label=sitio)](https://lucasramos.uy/normativa/)

Scrapers de normativa uruguaya desde [IMPO](https://www.impo.com.uy). Esta rama solo genera datos.

## Ramas

| Rama | Contenido |
| --- | --- |
| `main` | Scrapers y sus workflows. Genera `data/*.jsonl` y `reports/`. |
| `api` | Solo los datos publicados, más `historial/`. Se actualiza a mano desde `main`. |
| `www` | La web ([lucasramos.uy/normativa](https://lucasramos.uy/normativa/)). Lee `data/` e `historial/` desde `api`. |

## Flujo

1. **Revisión semanal de IMPO** corre los lunes (o a mano con *Run workflow*). Descarga la Constitución y los códigos y, si cambió el contenido, abre un PR contra `main` con el resumen de artículos modificados, agregados y eliminados.
2. Revisar y mergear el PR.
3. Publicar: **Actions → Publicar datos en api → Run workflow**. Copia `data/` y `reports/` a `api`, actualiza `historial/` y vuelve a desplegar la web.

## Historial de cambios

`scripts/ingest/historial.py` corre dentro de *Publicar datos en api*. Compara cada publicación con la anterior, artículo por artículo (sin contar `fecha_scraping` ni `hash_contenido`), y escribe en `api`:

- `historial/<norma>.json`: `{norma, desde, total, entradas[]}`. Cada entrada tiene `articulo`, `tipo` (`modificado`, `agregado`, `eliminado`), `campos`, `antes`, `despues`, `publicado` (commit de api), `detectado` (commit de main que trajo el cambio), `main_sha` y `pr`.
- `historial/index.json`: totales por norma y las últimas 300 entradas.

Solo entra lo publicado en `api`. Las fechas son las de detección y publicación en Normativa, no las de vigencia.

## Estructura

```
.github/workflows/
  scrape-semanal.yml    # Constitución + códigos, abre PR si hay cambios
  publish-api.yml       # main -> api (manual) + historial + redeploy de www
scripts/ingest/         # scrapers, diff_datos.py, historial.py (ver scripts/ingest/README.md)
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
python scripts/ingest/scrape_codigos.py --user-agent "normativa-uy-scraper/1.0 (+https://github.com/lucasramosuy/normativa)"
```

## Criterios

- Se consulta `robots.txt` y se respeta el Crawl-Delay (mínimo 10 s).
- User-agent identificado.
- Validación contra el índice oficial de IMPO: sin faltantes, duplicados ni textos vacíos. Si algo no cierra, no se escribe nada.

## Pendientes (roadmap)

Actualizado el 23/09/2026.

**Búsqueda**
- Revisar la lentitud en las consultas cortas o muy genéricas ("6", "articulo", que coinciden con miles de páginas).
- Mejorar el orden de resultados (por ejemplo, que "legítima defensa" muestre primero Penal art. 26). En pausa.

**Datos**
- Más normas: Código Tributario, leyes y decretos.

**Sitio**
- Imagen de vista previa por artículo al compartir links (og).

Hecho: dominio lucasramos.uy/normativa, API v1 documentada, proxy propio para Sentry y PostHog, historial de cambios por artículo con página de cambios y feed.
