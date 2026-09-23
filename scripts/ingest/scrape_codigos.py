#!/usr/bin/env python3
"""Descarga y valida el texto actualizado de los códigos uruguayos desde IMPO.

Generalización de scrape_constitucion.py: misma estrategia (una request
"Toda la Norma" por código, validación contra el índice oficial de IMPO,
salida JSONL + reporte), pero leyendo la lista de códigos desde
codigos.json y soportando las variantes que tienen los códigos:

- Artículos con sufijo: "Artículo 149-BIS" (ancla IMPO "149BIS").
- Artículos agrupados por rango: "Artículo 131-144" (ancla IMPO "131144"),
  típicamente series derogadas.
- Jerarquía de encabezados LIBRO / TITULO / CAPITULO / SECCION (la
  Constitución solo usa SECCION / CAPITULO). El nivel TITULO se guarda en
  el campo "titulo_norma" para no chocar con "titulo" ("Artículo N").

Salida por código:
  - data/{id}.jsonl            una línea JSON por artículo
  - reports/last_run_{id}.json cobertura, validación y hash del dataset
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup, Tag

ROBOTS_URL = "https://www.impo.com.uy/robots.txt"
ARTICLE_RE = re.compile(r"^Artículo\s+(\S+)$", re.IGNORECASE)
SPACE_RE = re.compile(r"[ \t]+")
ANCHOR_RE = re.compile(r"^\d")  # ids de ancla que empiezan con dígito (excluye "TITULO")
FECHA_RE = re.compile(r"(\d{2}/\d{2}/\d{4})")

# Jerarquía de encabezados de los códigos, de mayor a menor nivel.
NIVELES = ["parte", "libro", "titulo_norma", "capitulo", "seccion"]
PALABRAS_NIVEL = {
    "PARTE": "parte",
    "LIBRO": "libro",
    "TITULO": "titulo_norma",
    "CAPITULO": "capitulo",
    "SECCION": "seccion",
}


def clean_text(value: str) -> str:
    lines = [SPACE_RE.sub(" ", line).strip() for line in value.replace("\r", "").split("\n")]
    return "\n".join(line for line in lines if line).strip()


def sin_acentos(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")


def normalizar_id_articulo(raw: str) -> str:
    """'149-BIS' -> '149BIS'; '131-144' -> '131144' (formato del ancla IMPO)."""
    return raw.upper().replace("-", "").replace(" ", "").rstrip("º°")


_robots_por_sesion: dict[int, RobotFileParser] = {}


def robots_de(session: requests.Session) -> RobotFileParser:
    """robots.txt de IMPO, descargado una sola vez por corrida (por sesión)."""
    robots = _robots_por_sesion.get(id(session))
    if robots is None:
        robots = RobotFileParser(ROBOTS_URL)
        robots.parse(session.get(ROBOTS_URL, timeout=30).text.splitlines())
        _robots_por_sesion[id(session)] = robots
    return robots


def fetch_norma(url: str, user_agent: str, session: requests.Session) -> tuple[str, int]:
    robots = robots_de(session)
    if not robots.can_fetch(user_agent, url):
        raise RuntimeError(f"robots.txt no permite descargar {url}")
    delay = max(10, int(robots.crawl_delay(user_agent) or robots.crawl_delay("*") or 10))
    time.sleep(delay)
    response = session.get(url, timeout=(30, 120))
    response.raise_for_status()
    response.encoding = response.encoding or "ISO-8859-1"
    return response.text, delay


def actualizar_niveles(niveles: dict, heading_text: str) -> None:
    """Actualiza la ruta LIBRO/TITULO/CAPITULO/SECCION vigente con las líneas
    de un h3.resultado. Una línea puede ser solo el número del nivel
    ('LIBRO I') y la siguiente su nombre ('DISPOSICIONES GENERALES')."""
    for linea in clean_text(heading_text).splitlines():
        upper = sin_acentos(linea).upper()
        palabra = upper.split(" ", 1)[0] if upper else ""
        nivel = PALABRAS_NIVEL.get(palabra)
        if nivel:
            niveles[nivel] = linea
            for mas_bajo in NIVELES[NIVELES.index(nivel) + 1:]:
                niveles[mas_bajo] = None
        elif niveles.get(NIVELES[-1]) or any(niveles.values()):
            # continuación del encabezado anterior (nombre en línea aparte)
            for nivel_actual in reversed(NIVELES):
                if niveles.get(nivel_actual):
                    niveles[nivel_actual] = f"{niveles[nivel_actual]} - {linea}"
                    break


def parse_norma(html: str, documento: str, url: str, scraped_at: str) -> tuple[list[dict], dict]:
    soup = BeautifulSoup(html, "html.parser")
    page_text = clean_text(soup.get_text("\n"))
    updated = "Documento Actualizado" in page_text
    promulgacion = re.search(r"Promulgación:\s*(\d{2}/\d{2}/\d{4})", page_text)
    publicacion = re.search(r"Publicación:\s*(\d{2}/\d{2}/\d{4})", page_text)

    expected = {
        tag.get("id")
        for tag in soup.find_all("a")
        if tag.get("id") and tag.get("id") == tag.get("name") and ANCHOR_RE.match(tag.get("id"))
    }
    if not expected:
        raise RuntimeError(f"IMPO no expuso el índice oficial de artículos de {documento}")

    records = []
    niveles: dict = {n: None for n in NIVELES}
    for heading in soup.find_all(["h3", "h4"]):
        if heading.name == "h3":
            if "resultado" in (heading.get("class") or []):
                actualizar_niveles(niveles, heading.get_text("\n"))
            continue

        match = ARTICLE_RE.fullmatch(clean_text(heading.get_text(" ")))
        if not match:
            continue
        display = match.group(1).rstrip("º°")
        id_norm = normalizar_id_articulo(display)
        # IMPO a veces muestra "Artículo 176" en el título pero el ancla es "176A"
        # (Código Rural). Manda el ancla, que es el identificador único.
        ancla = heading.find_previous_sibling()
        ancla_id = ancla.get("id") if isinstance(ancla, Tag) and ancla.name == "a" else None
        if ancla_id and ancla_id != id_norm and ancla_id.startswith(id_norm) and ancla_id[len(id_norm):].isalpha():
            display = f"{display}-{ancla_id[len(id_norm):]}"
            id_norm = ancla_id

        body = heading.find_next_sibling("pre")
        if body is None or "italica" in (body.get("class") or []):
            raise RuntimeError(f"No se encontró texto para el artículo {display} de {documento}")

        notes = []
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag) and sibling.name in {"h3", "h4"}:
                break
            if isinstance(sibling, Tag) and sibling.name == "pre" and "italica" in (sibling.get("class") or []):
                note = clean_text(sibling.get_text(" "))
                note = re.sub(r"^\(\*\)\s*Notas:\s*", "", note, flags=re.IGNORECASE)
                if note:
                    notes.append(note)

        text = clean_text(body.get_text("\n"))
        records.append({
            "documento": documento,
            "articulo": int(display) if display.isdigit() else display,
            "articulo_id": id_norm,
            "titulo": f"Artículo {display}",
            "libro": niveles["libro"],
            "titulo_norma": niveles["titulo_norma"],
            "capitulo": niveles["capitulo"],
            "seccion": niveles["seccion"],
            "texto": text,
            "notas_oficiales": "\n".join(notes) or None,
            "url_fuente": f"{url}/{id_norm}",
            "fecha_promulgacion": promulgacion.group(1) if promulgacion else None,
            "fecha_publicacion": publicacion.group(1) if publicacion else None,
            "fecha_scraping": scraped_at,
            "estado_actual": "documento_actualizado" if updated else "no_determinado",
            "hash_contenido": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        })

    ids = [r["articulo_id"] for r in records]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    missing = sorted(expected - set(ids))
    unexpected = sorted(set(ids) - expected)
    if duplicates or missing or unexpected:
        raise RuntimeError(json.dumps({
            "documento": documento,
            "duplicados": duplicates,
            "faltantes_en_salida": missing,
            "inesperados_en_salida": unexpected,
        }, ensure_ascii=False))
    # Algunos artículos figuran en IMPO sin texto (p. ej. Código Rural, art. 259). Se guardan
    # vacíos y se informan en el reporte; si faltan todos, algo cambió en la página.
    sin_texto = [r["articulo_id"] for r in records if not r["texto"]]
    if len(sin_texto) > max(3, len(records) // 20):
        raise RuntimeError(f"Demasiados artículos sin texto en {documento}: {sin_texto[:20]}")

    report = {
        "fuente": url,
        "documento": documento,
        "fecha_scraping": scraped_at,
        "estado_actual": "documento_actualizado" if updated else "no_determinado",
        "articulos_esperados_segun_impo": len(expected),
        "articulos_guardados": len(records),
        "duplicados": 0,
        "faltantes": 0,
        "sin_texto_en_impo": sin_texto,
        "sha256_jsonl": None,
    }
    return records, report


def write_outputs(records: list[dict], report: dict, data_path: Path, report_path: Path) -> None:
    data_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    jsonl = "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in records)
    report["sha256_jsonl"] = hashlib.sha256(jsonl.encode("utf-8")).hexdigest()
    data_path.write_text(jsonl, encoding="utf-8")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Scraper de códigos de IMPO")
    parser.add_argument("--user-agent", required=True)
    parser.add_argument("--config", default=str(Path(__file__).parent / "codigos.json"))
    parser.add_argument("--solo", default=None, help="Correr un solo código por id (ej. codigo-civil)")
    parser.add_argument("--tolerante", action="store_true",
                        help="Si una norma falla, conservar su archivo anterior y seguir con las demás")
    args = parser.parse_args()
    if "http" not in args.user_agent.lower():
        raise SystemExit("--user-agent debe incluir una URL de contacto identificable")

    normas = json.loads(Path(args.config).read_text(encoding="utf-8"))
    if args.solo:
        normas = [n for n in normas if n["id"] == args.solo]
        if not normas:
            raise SystemExit(f"id desconocido en {args.config}: {args.solo}")

    scraped_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    session = requests.Session()
    session.headers.update({"User-Agent": args.user_agent, "Accept-Language": "es-UY,es;q=0.9"})

    errores = []
    for norma in normas:
        try:
            html, delay = fetch_norma(norma["url"], args.user_agent, session)
            records, report = parse_norma(html, norma["documento"], norma["url"], scraped_at)
        except Exception as exc:  # noqa: BLE001
            if not args.tolerante:
                raise
            # Se conserva el archivo anterior de esa norma y se sigue con las demás.
            errores.append({"id": norma["id"], "error": str(exc)[:500]})
            print(f"ERROR: {norma['id']}: {exc}")
            continue
        report["crawl_delay_segundos"] = delay
        report["user_agent"] = args.user_agent
        write_outputs(records, report, Path(f"data/{norma['id']}.jsonl"),
                      Path(f"reports/last_run_{norma['id']}.json"))
        print(f"OK: {norma['id']}: {len(records)} artículos")

    if errores:
        Path("reports").mkdir(exist_ok=True)
        nombre = Path(args.config).stem
        Path(f"reports/errores_{nombre}.json").write_text(
            json.dumps(errores, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if len(errores) == len(normas):
            raise SystemExit("Fallaron todas las normas")


if __name__ == "__main__":
    main()
