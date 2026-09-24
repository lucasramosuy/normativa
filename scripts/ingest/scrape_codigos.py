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
import collections
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
NOTA_PREFIJO_RE = re.compile(r"^\(\*\)\s*Notas:\s*", re.IGNORECASE)

# Para leyes de 1830-1924 la página de IMPO "detalla únicamente los artículos con impactos
# de derogación o modificación" (ayudaDocumentos.html); el texto completo está en los
# datos abiertos (?json=true). Solo se consulta el JSON para esas leyes, para no duplicar
# requests (y Crawl-Delay) en todas las demás.
ANIO_PAGINA_PARCIAL = 1925

# Resiliencia ante caídas de IMPO: tras FALLAS_SEGUIDAS errores transitorios seguidos
# (5xx, timeout, conexión) se pausa y se reintentan esas normas.
FALLAS_SEGUIDAS = 3

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


def fetch_datos_abiertos(url: str, user_agent: str, session: requests.Session) -> dict:
    """JSON de datos abiertos de IMPO (misma URL + ?json=true). Viene en ISO-8859-1 y con
    saltos de línea crudos dentro de los strings, por eso strict=False."""
    json_url = f"{url}?json=true"
    robots = robots_de(session)
    if not robots.can_fetch(user_agent, json_url):
        raise RuntimeError(f"robots.txt no permite descargar {json_url}")
    delay = max(10, int(robots.crawl_delay(user_agent) or robots.crawl_delay("*") or 10))
    time.sleep(delay)
    response = session.get(json_url, timeout=(30, 120))
    response.raise_for_status()
    return json.loads(response.content.decode(response.encoding or "ISO-8859-1"), strict=False)


def html_a_texto(value: str | None) -> str:
    if not value:
        return ""
    return clean_text(BeautifulSoup(value.replace("<br>", "\n").replace("<br/>", "\n"),
                                    "html.parser").get_text())


def completar_con_datos_abiertos(records: list[dict], report: dict, datos: dict,
                                 documento: str, url: str,
                                 sin_texto_en_impo: bool = False) -> tuple[list[dict], dict]:
    """Agrega los artículos que la página no muestra, tomándolos del JSON de IMPO.
    Los que sí están en la página se conservan tal cual (misma fuente que el resto)."""
    articulos = datos.get("articulos") or []
    por_id = {r["articulo_id"]: r for r in records}
    base = records[0] if records else {}
    ids_json = []
    salida = []
    for art in articulos:
        display = str(art.get("nroArticulo", "")).strip().rstrip("º°")
        if not display:
            raise RuntimeError(f"Artículo sin número en el JSON de IMPO de {documento}")
        id_norm = normalizar_id_articulo(display)
        ids_json.append(id_norm)
        if id_norm in por_id:
            salida.append(por_id[id_norm])
            continue
        text = html_a_texto(art.get("textoArticulo"))
        # En el JSON, "(*)" marca que el artículo tiene notas; en la página no forma parte del texto.
        text = re.sub(r"\s*\(\*\)\s*$", "", text).strip()
        nota = NOTA_PREFIJO_RE.sub("", html_a_texto(art.get("notasArticulo")))
        salida.append({
            "documento": documento,
            "articulo": int(display) if display.isdigit() else display,
            "articulo_id": id_norm,
            "titulo": f"Artículo {display}",
            "libro": None,
            "titulo_norma": None,
            "capitulo": None,
            "seccion": None,
            "texto": text,
            "notas_oficiales": nota or None,
            "url_fuente": f"{url}/{id_norm}",
            "fecha_promulgacion": base.get("fecha_promulgacion"),
            "fecha_publicacion": base.get("fecha_publicacion"),
            "fecha_scraping": report["fecha_scraping"],
            "estado_actual": report["estado_actual"],
            "hash_contenido": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        })

    duplicados = sorted({i for i in ids_json if ids_json.count(i) > 1})
    solo_en_pagina = sorted(set(por_id) - set(ids_json))
    if duplicados or solo_en_pagina:
        raise RuntimeError(json.dumps({
            "documento": documento,
            "duplicados_en_json": duplicados,
            "en_pagina_pero_no_en_json": solo_en_pagina,
        }, ensure_ascii=False))
    sin_texto = [r["articulo_id"] for r in salida if not r["texto"]]
    # sin_texto_en_impo (en leyes.json): IMPO no publica el texto de esa ley (solo la
    # imagen del Diario Oficial). Se guardan los artículos vacíos, con sus notas.
    if not sin_texto_en_impo and len(sin_texto) > max(3, len(salida) // 20):
        raise RuntimeError(f"Demasiados artículos sin texto en {documento}: {sin_texto[:20]}")

    report = dict(report)
    report["articulos_esperados_segun_impo"] = len(salida)
    report["articulos_guardados"] = len(salida)
    report["sin_texto_en_impo"] = sin_texto
    report["articulos_desde_datos_abiertos"] = [i for i in ids_json if i not in por_id]
    return salida, report


def es_error_transitorio(exc: Exception) -> bool:
    """Caída o sobrecarga de IMPO (no un cambio en la página)."""
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code >= 500
    return False


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

        # El texto es el primer <pre> sin clase "italica" antes del próximo título. Algunos
        # artículos en IMPO solo tienen la nota de modificación (p. ej. Ley 5.350, art. 6):
        # se guardan con texto vacío y la nota, y quedan en sin_texto_en_impo del reporte.
        body = None
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag) and sibling.name in {"h3", "h4"}:
                break
            if isinstance(sibling, Tag) and sibling.name == "pre" and "italica" not in (sibling.get("class") or []):
                body = sibling
                break

        notes = []
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag) and sibling.name in {"h3", "h4"}:
                break
            if isinstance(sibling, Tag) and sibling.name == "pre" and "italica" in (sibling.get("class") or []):
                note = clean_text(sibling.get_text(" "))
                note = re.sub(r"^\(\*\)\s*Notas:\s*", "", note, flags=re.IGNORECASE)
                if note:
                    notes.append(note)

        text = clean_text(body.get_text("\n")) if body is not None else ""
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
    parser.add_argument("--pausa-minutos", type=float, default=10,
                        help=f"Espera tras {FALLAS_SEGUIDAS} errores seguidos de IMPO (5xx/timeout) antes de reintentar")
    parser.add_argument("--max-pausas", type=int, default=3,
                        help="Máximo de pausas por corrida (para no pasarse del timeout del workflow)")
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
    errores_por_id: dict[str, str] = {}
    racha: list[dict] = []  # normas con error transitorio seguidas, pendientes de reintento
    pausas = 0
    pendientes = collections.deque(normas)
    while pendientes:
        norma = pendientes.popleft()
        try:
            html, delay = fetch_norma(norma["url"], args.user_agent, session)
            records, report = parse_norma(html, norma["documento"], norma["url"], scraped_at)
            if (norma.get("anio") or ANIO_PAGINA_PARCIAL) < ANIO_PAGINA_PARCIAL:
                datos = fetch_datos_abiertos(norma["url"], args.user_agent, session)
                if len(datos.get("articulos") or []) > len(records):
                    records, report = completar_con_datos_abiertos(
                        records, report, datos, norma["documento"], norma["url"],
                        norma.get("sin_texto_en_impo", False))
        except Exception as exc:  # noqa: BLE001
            transitorio = es_error_transitorio(exc)
            if transitorio:
                racha.append(norma)
            if transitorio and pausas < args.max_pausas and (
                    len(racha) >= FALLAS_SEGUIDAS or not args.tolerante):
                # IMPO parece caído: esperar y reintentar las normas de la racha.
                pausas += 1
                print(f"PAUSA {pausas}/{args.max_pausas}: {len(racha)} fallas seguidas de IMPO "
                      f"({exc}); reintento en {args.pausa_minutos} min")
                time.sleep(args.pausa_minutos * 60)
                pendientes.extendleft(reversed(racha))
                racha.clear()
                continue
            if not args.tolerante:
                raise
            # Se conserva el archivo anterior de esa norma y se sigue con las demás.
            if not transitorio:
                errores.append({"id": norma["id"], "error": str(exc)[:500]})
            errores_por_id[norma["id"]] = str(exc)[:500]
            print(f"ERROR: {norma['id']}: {exc}")
            continue
        for fallida in racha:  # fallas sueltas: IMPO respondió después, no se reintentan
            errores.append({"id": fallida["id"], "error": errores_por_id[fallida["id"]]})
        racha.clear()
        report["crawl_delay_segundos"] = delay
        report["user_agent"] = args.user_agent
        write_outputs(records, report, Path(f"data/{norma['id']}.jsonl"),
                      Path(f"reports/last_run_{norma['id']}.json"))
        extra = report.get("articulos_desde_datos_abiertos")
        print(f"OK: {norma['id']}: {len(records)} artículos"
              + (f" ({len(extra)} desde datos abiertos)" if extra else ""))

    for fallida in racha:
        errores.append({"id": fallida["id"], "error": errores_por_id[fallida["id"]]})
    if errores:
        Path("reports").mkdir(exist_ok=True)
        nombre = Path(args.config).stem
        Path(f"reports/errores_{nombre}.json").write_text(
            json.dumps(errores, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if len(errores) == len(normas):
            raise SystemExit("Fallaron todas las normas")


if __name__ == "__main__":
    main()
