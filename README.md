# Sistema Personal de Conocimiento Académico (Derecho + Sociología, Uruguay)

Corpus normativo + apuntes + bibliografía, procesado en chunks con metadata,
indexado con embeddings para búsqueda semántica en lenguaje natural.

Fuente principal: [IMPO](https://www.impo.com.uy) (Centro de Información Oficial de Uruguay).

## Estructura del proyecto

```
/sources_raw/          # HTML/PDF crudo, sin tocar
/sources_processed/    # texto limpio en Markdown/JSON
/chunks/                # fragmentos + metadata (listos para embeddings)
/embeddings/            # vectores + índice FAISS
/schemas/               # esquema de metadata (JSON Schema) + ejemplos
/scripts/
  ingest/               # scrapers por fuente (IMPO, ANEP, etc.)
  process/              # limpieza, chunking, normalización
  index/                # generación y actualización de embeddings/FAISS
  query/                # búsqueda semántica sobre el índice
/notebooks/             # prototipado en Colab
```

## Setup

```bash
python -m venv venv
source venv/bin/activate  # en Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Esquema de metadata

Cada documento procesado (típicamente un artículo de una norma) debe cumplir
`schemas/metadata_schema.json`. Ver `schemas/ejemplo_documento.json` para un caso concreto.

Campos obligatorios: `id`, `fuente`, `tipo`, `titulo`, `texto`, `url_origen`, `fecha_scrapeo`, `vigente`.

Convención de `id`: `{tipo}_{titulo_slug}_art_{n}` — ej. `constitucion_1967_art_7`,
`codigo_civil_art_1245`.

## Estado del roadmap

- [x] Fase 0 — Setup del proyecto
- [ ] Fase 1 — Corpus normativo estable (Constitución + Códigos)
- [ ] Fase 2 — Pipeline de procesamiento
- [ ] Fase 3 — Embeddings y búsqueda semántica
- [ ] Fase 4 — Ampliar el corpus
- [ ] Fase 5 — Automatización
- [ ] Fase 6 — Interfaz (opcional)

## Notas éticas/técnicas

- Antes de scrapear IMPO: revisar `impo.com.uy/robots.txt`.
- Respetar rate limits (delays entre requests) e identificar el user-agent.
- No redistribuir el corpus completo públicamente salvo que el sitio lo habilite.

## Constitución uruguaya desde IMPO

El workflow manual genera `data/constitucion.jsonl`, una línea JSON por artículo, y `reports/last_run.json`, con cobertura y hash del dataset.

Para actualizar: **Actions → Actualizar Constitución desde IMPO → Run workflow**.

El proceso consulta `robots.txt`, respeta un mínimo de 10 segundos, descubre el total desde el índice oficial, valida huecos y duplicados y solo hace commit si cambian las salidas.

Fuente: https://www.impo.com.uy/bases/constitucion/1967-1967