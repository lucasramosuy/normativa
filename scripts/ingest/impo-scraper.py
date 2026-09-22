"""
Scraper de normas de IMPO (impo.com.uy) - Fase 1 del roadmap.

Estrategia:
  IMPO publica cada norma completa en una sola URL "Toda la Norma"
  (ej. https://www.impo.com.uy/bases/constitucion/1967-1967), con todos
  los artículos en la misma página. Eso significa UNA sola request HTTP
  por norma, en vez de una por artículo — mucho más liviano y más fácil
  de mantener dentro del Crawl-Delay: 10 que exige su robots.txt.

Salida:
  - HTML crudo -> /sources_raw/{tipo}/{id_norma}.html
  - JSON procesado (uno por artículo, matcheando schemas/metadata_schema.json)
    -> /sources_processed/{tipo}/{id_norma}.json  (lista de artículos)

IMPORTANTE (leer antes de correr):
  Este parser fue construido inspeccionando el HTML renderizado de IMPO,
  no pude probarlo en un entorno con acceso real al sitio. La lógica de
  parseo (parse_articulos) es la parte más frágil: si algo no matchea,
  correr con --debug para ver qué está encontrando y ajustar los
  patrones de PATRON_ARTICULO / PATRON_SECCION más abajo.
"""

import argparse
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# --- Configuración general -------------------------------------------------

USER_AGENT = "sistema-conocimiento-academico-personal/0.1 (uso educativo personal; contacto: TU_EMAIL_ACA)"
CRAWL_DELAY_SEGUNDOS = 10  # impuesto por impo.com.uy/robots.txt

ROOT = Path(__file__).resolve().parents[2]  # raíz del proyecto knowledge-system/
SOURCES_RAW = ROOT / "sources_raw"
SOURCES_PROCESSED = ROOT / "sources_processed"

# Patrón para encabezados de artículo, ej: "Artículo 1", "Artículo 47"
PATRON_ARTICULO = re.compile(r"^Art[íi]culo\s+(\d+)\s*$", re.IGNORECASE)

# Patrón para encabezados de sección/capítulo, ej:
# "SECCION I - DE LA NACION Y SU SOBERANIA  CAPITULO I" o "CAPITULO II"
PATRON_SECCION = re.compile(r"^(SECCION|CAP[IÍ]TULO)\b", re.IGNORECASE)

MARCADOR_NOTAS = "(*)Notas:"


# --- Fetch -------------------------------------------------------------


def fetch_norma_html(url: str) -> str:
    """Descarga el HTML crudo de una norma completa de IMPO."""
    headers = {"User-Agent": USER_AGENT}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    # IMPO sirve el contenido en ISO-8859-1 (Latin-1), no UTF-8.
    resp.encoding = resp.apparent_encoding or "ISO-8859-1"
    return resp.text


# --- Parseo --------------------------------------------------------------


def parse_articulos(html: str, tipo: str, titulo: str, id_norma: str,
                     url_origen: str, fecha_scrapeo: str, debug: bool = False):
    """
    Recorre los headings (h1-h6) y bloques <pre> en orden de documento
    para reconstruir cada artículo: número, sección/capítulo vigente,
    cuerpo del texto y notas.
    """
    soup = BeautifulSoup(html, "html.parser")
    nodos = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "pre"])

    articulos = []
    seccion_actual = None
    articulo_actual = None
    buffer_pre = []  # bloques <pre> acumulados desde el último heading de artículo

    def cerrar_articulo():
        """Vuelca el artículo actual (si hay uno abierto) a la lista de salida."""
        nonlocal articulo_actual, buffer_pre
        if articulo_actual is None:
            buffer_pre = []
            return
        texto = buffer_pre[0].strip() if buffer_pre else ""
        notas = None
        if len(buffer_pre) > 1:
            resto = "\n".join(b.strip() for b in buffer_pre[1:])
            # el primer bloque de "resto" suele ser el separador "---\n(*)Notas:"
            notas = resto.split(MARCADOR_NOTAS, 1)[-1].strip() if MARCADOR_NOTAS in resto else resto

        if texto:
            articulos.append({
                "id": f"{tipo}_{id_norma}_art_{articulo_actual}",
                "fuente": "IMPO",
                "tipo": tipo,
                "titulo": titulo,
                "articulo": articulo_actual,
                "inciso": None,
                "materia": None,
                "texto": normalizar_texto(texto),
                "seccion_capitulo": seccion_actual,  # campo extra, no está en el schema mínimo
                "url_origen": f"{url_origen}/{articulo_actual}",
                "fecha_scrapeo": fecha_scrapeo,
                "vigente": True,
                "hash_contenido": None,
                "notas": normalizar_texto(notas) if notas else None,
            })
        articulo_actual = None
        buffer_pre = []

    for nodo in nodos:
        if nodo.name == "pre":
            if articulo_actual is not None:
                buffer_pre.append(nodo.get_text())
            continue

        texto_heading = nodo.get_text(strip=True)
        if not texto_heading:
            continue

        m_art = PATRON_ARTICULO.match(texto_heading)
        if m_art:
            cerrar_articulo()
            articulo_actual = m_art.group(1)
            if debug:
                print(f"[debug] Artículo detectado: {articulo_actual}")
            continue

        if PATRON_SECCION.match(texto_heading):
            cerrar_articulo()
            seccion_actual = texto_heading
            if debug:
                print(f"[debug] Sección/Capítulo detectado: {seccion_actual}")
            continue

        # Otros headings (título de la norma, "Fecha de Publicación", etc.) se ignoran.

    cerrar_articulo()  # por si el último artículo quedó abierto al terminar el loop

    if not articulos:
        raise ValueError(
            "No se detectó ningún artículo. La estructura del HTML no matchea "
            "los patrones esperados (PATRON_ARTICULO / PATRON_SECCION). "
            "Correr con --debug y revisar el HTML crudo guardado en sources_raw/."
        )

    return articulos


def normalizar_texto(texto: str) -> str:
    """Colapsa saltos de línea de word-wrap fijo en espacios, preserva párrafos."""
    if not texto:
        return texto
    parrafos = re.split(r"\n\s*\n", texto)
    parrafos = [" ".join(p.split()) for p in parrafos if p.strip()]
    return "\n".join(parrafos)


# --- Guardado ------------------------------------------------------------


def guardar_raw(html: str, tipo: str, id_norma: str) -> Path:
    carpeta = SOURCES_RAW / tipo
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / f"{id_norma}.html"
    ruta.write_text(html, encoding="utf-8")
    return ruta


def guardar_processed(articulos: list, tipo: str, id_norma: str) -> Path:
    carpeta = SOURCES_PROCESSED / tipo
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / f"{id_norma}.json"
    ruta.write_text(json.dumps(articulos, ensure_ascii=False, indent=2), encoding="utf-8")
    return ruta


# --- Orquestación --------------------------------------------------------


def scrape_norma(config: dict, debug: bool = False):
    """
    config: {"tipo": "constitucion", "titulo": "...", "id_norma": "1967-1967",
             "url": "https://www.impo.com.uy/bases/constitucion/1967-1967"}
    """
    from datetime import date

    print(f"Descargando: {config['url']}")
    html = fetch_norma_html(config["url"])
    guardar_raw(html, config["tipo"], config["id_norma"])

    fecha_scrapeo = date.today().isoformat()
    articulos = parse_articulos(
        html,
        tipo=config["tipo"],
        titulo=config["titulo"],
        id_norma=config["id_norma"],
        url_origen=config["url"],
        fecha_scrapeo=fecha_scrapeo,
        debug=debug,
    )
    ruta = guardar_processed(articulos, config["tipo"], config["id_norma"])
    print(f"  -> {len(articulos)} artículos guardados en {ruta}")
    return articulos


def main():
    parser = argparse.ArgumentParser(description="Scraper de normas de IMPO")
    parser.add_argument("--config", default="normas_config.json",
                         help="JSON con la lista de normas a scrapear")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    config_path = Path(__file__).parent / args.config
    normas = json.loads(config_path.read_text(encoding="utf-8"))

    for i, norma in enumerate(normas):
        scrape_norma(norma, debug=args.debug)
        if i < len(normas) - 1:
            print(f"Esperando {CRAWL_DELAY_SEGUNDOS}s (Crawl-Delay de robots.txt)...")
            time.sleep(CRAWL_DELAY_SEGUNDOS)


if __name__ == "__main__":
    main()