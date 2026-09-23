# Normativa Uruguay - api

Datos publicados de normativa uruguaya, extraídos de [IMPO](https://www.impo.com.uy).

- `data/*.jsonl`: una línea JSON por artículo. Formato documentado en el README de `main`.
- `reports/*.json`: cobertura, validación y sha256 de cada corrida.

Esta rama no se edita a mano: se actualiza desde `main` con **Actions → Publicar datos en api**. La web (`www`) lee `data/` desde acá.

Acceso directo a un archivo: `https://raw.githubusercontent.com/lucasramosuy/normativa/api/data/constitucion.jsonl`

## API

Los mismos datos están disponibles como endpoints JSON estáticos en `https://lucasramos.uy/normativa/api/v1/`:

- `normas.json`: todas las normas, con cantidad de artículos y enlaces.
- `{norma}.json`: índice de artículos de una norma, sin el texto.
- `{norma}/{articulo}.json`: un artículo completo.

Documentación completa (campos, ejemplos, actualización y nota sobre IMPO): https://lucasramos.uy/normativa/api/
