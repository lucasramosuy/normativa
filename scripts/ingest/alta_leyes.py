#!/usr/bin/env python3
"""Alta automática de leyes, decretos-ley y decretos.

Lee scripts/ingest/leyes.json. Una entrada mínima trae solo `url` (de IMPO), `corto` y `area`.
Este script:
1. Valida las entradas mínimas (url, nombre corto, área, sin ids repetidos). Si algo no
   cierra, termina con error y no escribe nada.
2. Completa cada una con el JSON de datos abiertos de IMPO (id, documento, tipo, numero,
   anio, titulo_impo) y la deja en el mismo formato que el resto del archivo.
3. Descarga solo las normas que todavía no tienen data/<id>.jsonl (sin modo tolerante:
   si IMPO falla o no tiene la norma, la corrida falla y se ve en Actions).
4. Reescribe leyes.json y la línea de conteo del README (calculada de los datos).

Idempotente: sin entradas nuevas no cambia nada. Imprime "cambios=true" o "cambios=false".
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

sys.path.insert(0, str(Path(__file__).parent))
from scrape_codigos import fetch_datos_abiertos  # noqa: E402

URL_RE = re.compile(r"^https://www\.impo\.com\.uy/bases/(leyes|decretos-ley|decretos)/(\d+)-(\d{4})/?$")
TIPOS = {"leyes": "Ley", "decretos-ley": "Decreto-ley", "decretos": "Decreto"}
ORDEN = ("id", "documento", "tipo", "numero", "anio", "corto", "titulo_impo", "area", "url")
MARCA_INI = "<!-- conteo:inicio -->"
MARCA_FIN = "<!-- conteo:fin -->"


def miles(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def clave_url(url: str) -> tuple[str, str, int, int]:
    m = URL_RE.match(url or "")
    if not m:
        raise SystemExit(f"URL inválida (se espera https://www.impo.com.uy/bases/<leyes|decretos-ley|decretos>/<N>-<AAAA>): {url!r}")
    return m.group(1), TIPOS[m.group(1)], int(m.group(2)), int(m.group(3))


def id_y_numero(tipo: str, n: int, anio: int) -> tuple[str, str, str]:
    """(id, numero, documento) con el mismo formato que las entradas existentes."""
    if tipo == "Decreto":
        numero = f"{n}/{anio % 1000:03d}"
        return f"decreto-{n}-{anio}", numero, f"Decreto {numero}"
    numero = miles(n)
    prefijo = "ley" if tipo == "Ley" else "decreto-ley"
    return f"{prefijo}-{n}", numero, f"{tipo} {numero}"


def es_minima(e: dict) -> bool:
    return "id" not in e


def validar(entradas: list[dict], areas: set[str]) -> None:
    errores = []
    ids = set()
    for i, e in enumerate(entradas):
        try:
            _, tipo, n, anio = clave_url(e.get("url", ""))
        except SystemExit as exc:
            errores.append(f"entrada {i + 1}: {exc}")
            continue
        if not str(e.get("corto", "")).strip():
            errores.append(f"entrada {i + 1} ({e['url']}): falta `corto`")
        if e.get("area") not in areas:
            errores.append(f"entrada {i + 1} ({e['url']}): `area` {e.get('area')!r} no es una de {sorted(areas)}")
        id_ = e.get("id") or id_y_numero(tipo, n, anio)[0]
        if id_ in ids:
            errores.append(f"entrada {i + 1} ({e['url']}): id repetido {id_}")
        ids.add(id_)
    if errores:
        raise SystemExit("leyes.json no es válido:\n- " + "\n- ".join(errores))


def completar(e: dict, datos: dict) -> dict:
    """Entrada completa a partir de la mínima y del JSON de IMPO. Falla si IMPO no coincide."""
    _, tipo, n, anio = clave_url(e["url"])
    nro = re.sub(r"\D", "", str(datos.get("nroNorma", "")))
    if not nro or int(nro) != n or int(datos.get("anioNorma") or 0) != anio:
        raise SystemExit(f"IMPO no devuelve {e['url']} (nroNorma={datos.get('nroNorma')!r}, anioNorma={datos.get('anioNorma')!r})")
    titulo = " ".join(str(datos.get("nombreNorma") or "").split())
    if not titulo:
        raise SystemExit(f"IMPO no trae título para {e['url']}")
    id_, numero, documento = id_y_numero(tipo, n, anio)
    base = dict(e)
    base.update(id=id_, documento=documento, tipo=tipo, numero=numero, anio=anio, titulo_impo=titulo,
                corto=" ".join(e["corto"].split()))
    return {**{k: base[k] for k in ORDEN}, **{k: v for k, v in base.items() if k not in ORDEN}}


def escribir_leyes(path: Path, entradas: list[dict]) -> None:
    cuerpo = ",\n".join("  " + json.dumps(e, ensure_ascii=False) for e in entradas)
    path.write_text("[\n" + cuerpo + "\n]\n", encoding="utf-8")


def linea_conteo(root: Path, n_leyes: int) -> str:
    datos = sorted((root / "data").glob("*.jsonl"))
    articulos = sum(1 for f in datos for linea in f.read_text(encoding="utf-8").splitlines() if linea.strip())
    codigos = len(json.loads((root / "scripts/ingest/codigos.json").read_text(encoding="utf-8")))
    fecha = datetime.now(ZoneInfo("America/Montevideo")).strftime("%d/%m/%Y")
    return (f"Al {fecha}: la Constitución, {codigos} códigos y {n_leyes} leyes y decretos en `leyes.json` "
            f"({len(datos)} normas con datos en `main`, {miles(articulos)} artículos).")


def actualizar_readme(root: Path, n_leyes: int) -> bool:
    path = root / "README.md"
    texto = path.read_text(encoding="utf-8")
    ini, fin = texto.find(MARCA_INI), texto.find(MARCA_FIN)
    if ini < 0 or fin < ini:
        raise SystemExit(f"README.md no tiene las marcas {MARCA_INI} y {MARCA_FIN}")
    actual = texto[ini + len(MARCA_INI):fin].strip()
    nueva = linea_conteo(root, n_leyes)
    # Solo la fecha cambió: no es un cambio.
    if re.sub(r"^Al \d{2}/\d{2}/\d{4}", "", actual) == re.sub(r"^Al \d{2}/\d{2}/\d{4}", "", nueva):
        return False
    path.write_text(texto[:ini + len(MARCA_INI)] + "\n" + nueva + "\n" + texto[fin:], encoding="utf-8")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    ap.add_argument("--user-agent", required=True)
    args = ap.parse_args()
    root = Path(args.root)
    ruta = root / "scripts/ingest/leyes.json"
    entradas = json.loads(ruta.read_text(encoding="utf-8"))
    areas = {e["area"] for e in entradas if not es_minima(e) and e.get("area")}
    validar(entradas, areas)

    nuevas = [e for e in entradas if es_minima(e)]
    session = requests.Session()
    session.headers.update({"User-Agent": args.user_agent, "Accept-Language": "es-UY,es;q=0.9"})
    completas = []
    for e in entradas:
        if es_minima(e):
            print(f"Completando {e['url']} desde IMPO...", flush=True)
            e = completar(e, fetch_datos_abiertos(e["url"], args.user_agent, session))
            print(f"  -> {e['id']}: {e['titulo_impo']}", flush=True)
        completas.append(e)

    sin_datos = [e for e in completas if not (root / "data" / f"{e['id']}.jsonl").exists()]
    if sin_datos:
        with tempfile.TemporaryDirectory() as tmp:
            cfg = Path(tmp) / "alta.json"
            cfg.write_text(json.dumps(sin_datos, ensure_ascii=False), encoding="utf-8")
            r = subprocess.run([sys.executable, str(Path(__file__).parent / "scrape_codigos.py"),
                                "--config", str(cfg), "--user-agent", args.user_agent], cwd=root)
        if r.returncode != 0:
            raise SystemExit(f"El scraper falló con código {r.returncode}; no se escribió leyes.json.")
        faltan = [e["id"] for e in sin_datos if not (root / "data" / f"{e['id']}.jsonl").exists()]
        if faltan:
            raise SystemExit(f"El scraper no generó datos para: {', '.join(faltan)}")

    if nuevas:
        escribir_leyes(ruta, completas)
    readme = actualizar_readme(root, len(completas))
    cambios = bool(nuevas or sin_datos or readme)
    print(f"alta={len(nuevas)} nuevas, {len(sin_datos)} descargadas")
    print(f"cambios={'true' if cambios else 'false'}")


if __name__ == "__main__":
    main()
