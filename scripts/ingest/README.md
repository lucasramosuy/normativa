# Scraper de IMPO

## Uso

```bash
cd scripts/ingest
python impo_scraper.py --debug
```

`--debug` imprime cada artículo y sección/capítulo detectado a medida que
parsea — usalo la primera vez para confirmar que está funcionando bien
antes de dejarlo correr sin supervisión.

## Qué hace

1. Lee `normas_config.json` (lista de normas a scrapear: tipo, título, id, URL).
2. Para cada norma:
   - Descarga la página "Toda la Norma" completa (1 sola request).
   - Guarda el HTML crudo en `/sources_raw/{tipo}/{id_norma}.html`.
   - Parsea artículo por artículo y guarda el JSON en
     `/sources_processed/{tipo}/{id_norma}.json`.
   - Espera 10 segundos (Crawl-Delay de robots.txt) antes de pasar a la
     siguiente norma.

## Si falla el parseo (`No se detectó ningún artículo`)

Esto significa que la estructura HTML real de IMPO no coincide con lo que
asumió el script (headings h1-h6 para "Artículo N" y secciones, bloques
`<pre>` para el cuerpo del artículo y las notas). Para diagnosticar:

```python
from bs4 import BeautifulSoup
html = open("../../sources_raw/constitucion/1967-1967.html", encoding="utf-8").read()
soup = BeautifulSoup(html, "html.parser")
# Mirar qué tags rodean realmente a un "Artículo 1"
print(soup.find(string=lambda s: s and "rt" in s and "culo 1" in s).parent)
```

Y ajustar `PATRON_ARTICULO` / `PATRON_SECCION` o la lógica de
`parse_articulos` en `impo_scraper.py` según lo que aparezca.

## Agregar más normas

Sumá entradas a `normas_config.json`. Para encontrar la URL "Toda la Norma"
de un Código: buscarlo en impo.com.uy, entrar a cualquier artículo, y
clickear el link "Toda la Norma" — la URL sin el número de artículo al
final es la que va en `normas_config.json`.

Ejemplo (verificar la URL real antes de usarla, puede variar el slug):
```json
{
  "tipo": "codigo",
  "titulo": "Código Civil",
  "id_norma": "codigo-civil-1994",
  "url": "https://www.impo.com.uy/bases/codigo-civil/16603-1994/"
}
```

## Próximo paso (Fase 2 del roadmap)

Este script deja el corpus en `/sources_processed/{tipo}/{id_norma}.json`,
un artículo por objeto. El siguiente paso es la limpieza/chunking (ya viene
casi listo porque el chunking es "por artículo"), y unificar todo en el
formato de "documento procesado" antes de pasar a embeddings.