# Normativa Uruguay - api

Datos publicados de normativa uruguaya, extraídos de [IMPO](https://www.impo.com.uy).

- `data/*.jsonl`: una línea JSON por artículo. Formato documentado en el README de `main`.
- `reports/*.json`: cobertura, validación y sha256 de cada corrida.

Esta rama no se edita a mano: se actualiza desde `main` con **Actions → Publicar datos en api**. La web (`www`) lee `data/` desde acá.

Acceso directo a un archivo: `https://raw.githubusercontent.com/lucasramosuy/normativa-uy/api/data/constitucion.jsonl`
