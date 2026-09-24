# Scrapers de IMPO

## Constitución - `scrape_constitucion.py`

Script fijo para la Constitución (lo corre `scrape-semanal.yml`). Genera
`data/constitucion.jsonl` y `reports/last_run.json`.

## Códigos - `scrape_codigos.py`

Generalización del anterior para el resto de los códigos. Lee la lista de
`codigos.json` (id, documento, URL "Toda la Norma" de IMPO) y por cada uno
genera `data/{id}.jsonl` (una línea JSON por artículo) y
`reports/last_run_{id}.json` (cobertura, validación y hash).

```bash
python scripts/ingest/scrape_codigos.py \
  --user-agent "normativa-uy-scraper/1.0 (+https://github.com/lucasramosuy/normativa)"

# un solo código:
python scripts/ingest/scrape_codigos.py --user-agent "..." --solo codigo-civil
```

Qué hace por código:

1. Consulta `robots.txt` (una sola vez por corrida), verifica permiso y respeta
   el Crawl-Delay (mínimo 10 s) antes de cada norma.
2. Descarga la página "Toda la Norma" completa (1 sola request por código).
3. Parsea artículo por artículo, con la ruta de encabezados vigente
   (LIBRO / TITULO / CAPITULO / SECCION) y las notas oficiales.
4. Valida contra el índice oficial de IMPO (las anclas de la página):
   sin faltantes, sin duplicados, sin artículos inesperados. Si algo no
   cierra, falla y no escribe nada. Los artículos que IMPO publica sin texto
   o solo con su nota se guardan vacíos (con la nota) y se listan en
   `sin_texto_en_impo`; si son demasiados, falla.
5. Escribe el JSONL (claves ordenadas) y el reporte con el sha256 del dataset.

Casos especiales soportados:

- Artículos con sufijo: "Artículo 149-BIS" (`articulo_id` "149BIS").
- Rangos agrupados: "Artículo 131-144" (`articulo_id` "131144"), típico en
  series derogadas del Código Civil.
- El nivel TITULO se guarda en `titulo_norma` para no chocar con el campo
  `titulo` (que es "Artículo N").
- Leyes de 1830-1924 (`anio` < 1925 en `leyes.json`): la página de IMPO solo
  muestra los artículos modificados o derogados. Para esas leyes se baja también
  el JSON de datos abiertos (`?json=true`) y, si trae más artículos, se agregan
  los que faltan. El reporte los lista en `articulos_desde_datos_abiertos`.
  Si IMPO no publica el texto de una ley (solo la imagen del Diario Oficial,
  como la 5.350), se marca con `"sin_texto_en_impo": true` en `leyes.json` y se
  guardan sus artículos vacíos, con las notas.

Si IMPO se cae a mitad de corrida: tras 3 errores seguidos (5xx, timeout o
conexión) el script espera `--pausa-minutos` (10 por defecto) y reintenta esas
normas, hasta `--max-pausas` veces (3 por defecto). Después de eso, con
`--tolerante` sigue como antes: conserva el archivo anterior y anota el error.

## Agregar otra norma

Sumar una entrada a `codigos.json` con el `id` (slug para nombres de
archivo), el `documento` (nombre oficial) y la URL "Toda la Norma" de IMPO.
Antes de commitear, correr con `--solo` y revisar el reporte.

Las leyes y decretos van en `leyes.json` (mismos campos, más `tipo`, `numero`,
`anio`, `corto`, `titulo_impo` y `area`), una entrada por línea. `anio` también
decide si se consultan los datos abiertos (leyes anteriores a 1925). Cada ley
suma unos 15 s a la revisión semanal, que tiene un límite de 240 min.

## Revisión semanal - `scrape-semanal.yml` + `diff_datos.py`

Todos los lunes (06:17 de Montevideo, o a mano con "Run workflow") el workflow
"Revisión semanal de IMPO" corre los scrapers (Constitución, códigos y, con `--tolerante`, las leyes de `leyes.json`) y compara el resultado con lo
que hay en `main`, ignorando `fecha_scraping`. Si no cambió ningún artículo no
hace nada. Si cambió algo, abre un PR contra `main` con el resumen de artículos
modificados, agregados y eliminados (con el diff del texto). No publica en
`api`: después de mergear, publicar sigue siendo el workflow "Publicar datos en api".
