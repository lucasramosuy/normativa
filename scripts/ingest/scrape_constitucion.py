#!/usr/bin/env python3
"""Descarga y valida el texto actualizado completo de la Constitución desde IMPO."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup, Tag

SOURCE_URL = "https://www.impo.com.uy/bases/constitucion/1967-1967"
ROBOTS_URL = "https://www.impo.com.uy/robots.txt"
ARTICLE_RE = re.compile(r"^Artículo\s+(\d+)$", re.IGNORECASE)
SPACE_RE = re.compile(r"[ \t]+")


def clean_text(value: str) -> str:
    lines = [SPACE_RE.sub(" ", line).strip() for line in value.replace("\r", "").split("\n")]
    return "\n".join(line for line in lines if line).strip()


def fetch_source(user_agent: str) -> tuple[str, int]:
    session = requests.Session()
    session.headers.update({"User-Agent": user_agent, "Accept-Language": "es-UY,es;q=0.9"})
    response = session.get(ROBOTS_URL, timeout=30)
    response.raise_for_status()
    robots = RobotFileParser(ROBOTS_URL)
    robots.parse(response.text.splitlines())
    if not robots.can_fetch(user_agent, SOURCE_URL):
        raise RuntimeError(f"robots.txt no permite descargar {SOURCE_URL}")
    delay = max(10, int(robots.crawl_delay(user_agent) or robots.crawl_delay("*") or 10))
    time.sleep(delay)
    response = session.get(SOURCE_URL, timeout=60)
    response.raise_for_status()
    response.encoding = response.encoding or "ISO-8859-1"
    return response.text, delay


def parse_source(html: str, scraped_at: str) -> tuple[list[dict], dict]:
    soup = BeautifulSoup(html, "html.parser")
    page_text = clean_text(soup.get_text("\n"))
    updated = "Documento Actualizado" in page_text
    publication = re.search(r"Fecha de Publicación:\s*(\d{2}/\d{2}/\d{4})", page_text)
    expected = {
        int(tag.get("id"))
        for tag in soup.find_all("a", id=re.compile(r"^\d+$"))
        if tag.get("id") == tag.get("name")
    }
    if not expected:
        raise RuntimeError("IMPO no expuso el índice oficial de artículos")

    records = []
    current_section = None
    current_chapter = None
    for heading in soup.find_all(["h3", "h4"]):
        if heading.name == "h3" and "resultado" in (heading.get("class") or []):
            for line in clean_text(heading.get_text("\n")).splitlines():
                upper = line.upper()
                if upper.startswith("SECCION "):
                    current_section = line
                elif upper.startswith("CAPITULO "):
                    current_chapter = line
            continue

        match = ARTICLE_RE.fullmatch(clean_text(heading.get_text(" ")))
        if not match:
            continue
        number = int(match.group(1))
        body = heading.find_next_sibling("pre")
        if body is None or "italica" in (body.get("class") or []):
            raise RuntimeError(f"No se encontró texto para el artículo {number}")

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
            "documento": "Constitución de la República Oriental del Uruguay",
            "articulo": number,
            "titulo": f"Artículo {number}",
            "seccion": current_section,
            "capitulo": current_chapter,
            "texto": text,
            "notas_oficiales": "\n".join(notes) or None,
            "url_fuente": urljoin(SOURCE_URL + "/", str(number)),
            "fecha_publicacion": publication.group(1) if publication else None,
            "fecha_scraping": scraped_at,
            "estado_actual": "documento_actualizado" if updated else "no_determinado",
            "hash_contenido": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        })

    numbers = [record["articulo"] for record in records]
    duplicates = sorted({number for number in numbers if numbers.count(number) > 1})
    official_gaps = sorted(set(range(min(expected), max(expected) + 1)) - expected)
    missing = sorted(expected - set(numbers))
    unexpected = sorted(set(numbers) - expected)
    if duplicates or official_gaps or missing or unexpected:
        raise RuntimeError(json.dumps({
            "duplicados": duplicates,
            "huecos_en_indice_oficial": official_gaps,
            "faltantes_en_salida": missing,
            "inesperados_en_salida": unexpected,
        }, ensure_ascii=False))
    if any(not record["texto"] for record in records):
        raise RuntimeError("Hay artículos sin texto")

    records.sort(key=lambda record: record["articulo"])
    report = {
        "fuente": SOURCE_URL,
        "fecha_scraping": scraped_at,
        "estado_actual": "documento_actualizado" if updated else "no_determinado",
        "primer_articulo": records[0]["articulo"],
        "ultimo_articulo": records[-1]["articulo"],
        "articulos_esperados_segun_impo": len(expected),
        "articulos_guardados": len(records),
        "duplicados": 0,
        "faltantes": 0,
        "sha256_jsonl": None,
    }
    return records, report


def write_outputs(records: list[dict], report: dict, data_path: Path, report_path: Path) -> None:
    data_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    jsonl = "".join(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n" for record in records)
    report["sha256_jsonl"] = hashlib.sha256(jsonl.encode("utf-8")).hexdigest()
    data_path.write_text(jsonl, encoding="utf-8")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-agent", required=True)
    parser.add_argument("--data", default="data/constitucion.jsonl")
    parser.add_argument("--report", default="reports/last_run.json")
    args = parser.parse_args()
    if "http" not in args.user_agent.lower():
        raise SystemExit("--user-agent debe incluir una URL de contacto identificable")

    scraped_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    html, delay = fetch_source(args.user_agent)
    records, report = parse_source(html, scraped_at)
    report["crawl_delay_segundos"] = delay
    report["user_agent"] = args.user_agent
    write_outputs(records, report, Path(args.data), Path(args.report))
    print(f"OK: {len(records)} artículos; {args.data}; {args.report}")


if __name__ == "__main__":
    main()
