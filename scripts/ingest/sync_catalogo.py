#!/usr/bin/env python3
"""Regenera el catálogo de la web (rama www) desde main y los datos publicados en api.

Escribe en el checkout de www:
- src/data/leyes.json: las entradas de scripts/ingest/leyes.json de main, con los campos
  que usa la web y en el mismo formato que el archivo actual.
- README.md: la línea de conteo ("- La Constitución, N códigos y las leyes..."), con los
  números calculados: códigos de codigos.json, entradas de leyes.json y archivos de data/ en api.

Idempotente: si el catálogo y los conteos no cambiaron, no toca nada (la fecha sola no
cuenta como cambio). Imprime "cambios=true" o "cambios=false" al final.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

CAMPOS = ("id", "tipo", "numero", "anio", "corto", "titulo_impo", "area", "url")

LINEA_RE = re.compile(
    r"^- La Constitución, (?P<codigos>\d+) códigos y las leyes y decretos de `src/data/leyes\.json` "
    r"\((?P<normas>\d+) normas al (?P<fecha>\d{2}/\d{2}/\d{4}); una norma aparece cuando sus datos llegan a `api`, "
    r"que hoy publica (?P<api>\d+) conjuntos de datos\)(?P<resto>.*)$",
    re.MULTILINE,
)


def catalogo_desde_main(main: Path) -> list[dict]:
    leyes = json.loads((main / "scripts/ingest/leyes.json").read_text(encoding="utf-8"))
    ids = [x["id"] for x in leyes]
    if len(ids) != len(set(ids)):
        raise SystemExit("leyes.json de main tiene ids repetidos")
    return [{k: x[k] for k in CAMPOS} for x in leyes]


def serializar(catalogo: list[dict]) -> str:
    return json.dumps(catalogo, ensure_ascii=False, indent=1) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--main", required=True, help="checkout de main")
    ap.add_argument("--api", required=True, help="checkout de api")
    ap.add_argument("--www", required=True, help="checkout de www")
    args = ap.parse_args()
    main_dir, api_dir, www_dir = Path(args.main), Path(args.api), Path(args.www)

    catalogo = catalogo_desde_main(main_dir)
    codigos = len(json.loads((main_dir / "scripts/ingest/codigos.json").read_text(encoding="utf-8")))
    en_api = len(list((api_dir / "data").glob("*.jsonl")))
    if en_api == 0:
        raise SystemExit("api no tiene datos: no se genera el catálogo")

    destino = www_dir / "src/data/leyes.json"
    nuevo = serializar(catalogo)
    cambio_catalogo = not destino.exists() or destino.read_text(encoding="utf-8") != nuevo
    if cambio_catalogo:
        destino.write_text(nuevo, encoding="utf-8")

    readme = www_dir / "README.md"
    texto = readme.read_text(encoding="utf-8")
    m = LINEA_RE.search(texto)
    if not m:
        raise SystemExit("No encontré la línea de conteo del README; revisar LINEA_RE")
    mismos = (int(m["codigos"]), int(m["normas"]), int(m["api"])) == (codigos, len(catalogo), en_api)
    cambio_readme = not mismos
    if cambio_readme:
        fecha = datetime.now(ZoneInfo("America/Montevideo")).strftime("%d/%m/%Y")
        linea = (
            f"- La Constitución, {codigos} códigos y las leyes y decretos de `src/data/leyes.json` "
            f"({len(catalogo)} normas al {fecha}; una norma aparece cuando sus datos llegan a `api`, "
            f"que hoy publica {en_api} conjuntos de datos){m['resto']}"
        )
        readme.write_text(texto[: m.start()] + linea + texto[m.end():], encoding="utf-8")

    print(f"catalogo={len(catalogo)} codigos={codigos} api={en_api} "
          f"leyes.json={'cambió' if cambio_catalogo else 'igual'} README={'cambió' if cambio_readme else 'igual'}")
    print(f"cambios={'true' if cambio_catalogo or cambio_readme else 'false'}")


if __name__ == "__main__":
    sys.exit(main())
