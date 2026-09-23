"""Compara data/*.jsonl contra la versión commiteada (git HEAD) e informa cambios reales.

Ignora campos que cambian en cada corrida (fecha_scraping). Escribe un resumen en
Markdown (para el cuerpo del PR) y sale con código 0 si hubo cambios, 3 si no.

Uso: python scripts/ingest/diff_datos.py --out resumen.md
"""
from __future__ import annotations

import argparse
import difflib
import json
import subprocess
import sys
from pathlib import Path

IGNORAR = {"fecha_scraping"}
CAMPOS = {"texto": "texto", "notas_oficiales": "notas", "libro": "libro", "titulo_norma": "título",
          "seccion": "sección", "capitulo": "capítulo", "estado_actual": "estado", "url_fuente": "URL"}
MAX_BODY = 60000


def cargar(texto: str) -> dict[str, dict]:
    filas = {}
    for linea in texto.splitlines():
        if linea.strip():
            r = json.loads(linea)
            filas[str(r["articulo"])] = {k: v for k, v in r.items() if k not in IGNORAR}
    return filas


def en_head(ruta: Path) -> str | None:
    res = subprocess.run(["git", "show", f"HEAD:{ruta.as_posix()}"], capture_output=True, text=True)
    return res.stdout if res.returncode == 0 else None


def mini_diff(a: str, b: str) -> str:
    lineas = list(difflib.unified_diff((a or "").splitlines(), (b or "").splitlines(), lineterm="", n=1))[2:]
    return "\n".join(lineas[:40]) + ("\n…" if len(lineas) > 40 else "")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="resumen.md")
    args = ap.parse_args()

    secciones, totales = [], {"agregados": 0, "eliminados": 0, "modificados": 0}
    for archivo in sorted(Path(args.data).glob("*.jsonl")):
        nuevo = cargar(archivo.read_text(encoding="utf-8"))
        previo_txt = en_head(archivo)
        previo = cargar(previo_txt) if previo_txt else {}
        agregados = [k for k in nuevo if k not in previo]
        eliminados = [k for k in previo if k not in nuevo]
        modificados = [k for k in nuevo if k in previo and nuevo[k] != previo[k]]
        if not (agregados or eliminados or modificados):
            continue
        totales["agregados"] += len(agregados)
        totales["eliminados"] += len(eliminados)
        totales["modificados"] += len(modificados)
        doc = (next(iter(nuevo.values()), None) or next(iter(previo.values()), {})).get("documento", archivo.stem)
        partes = [f"### {doc} (`{archivo.name}`)",
                  f"{len(modificados)} modificados · {len(agregados)} agregados · {len(eliminados)} eliminados", ""]
        if agregados:
            partes.append("**Agregados:** " + ", ".join(f"[art. {k}]({nuevo[k].get('url_fuente', '')})" for k in agregados))
        if eliminados:
            partes.append("**Eliminados:** " + ", ".join(f"art. {k}" for k in eliminados))
        for k in modificados:
            a, b = previo[k], nuevo[k]
            cambiados = [n for c, n in CAMPOS.items() if a.get(c) != b.get(c)] or ["otros campos"]
            partes.append(f"\n<details><summary>Art. {k}: cambió {', '.join(cambiados)}</summary>\n")
            partes.append(f"Fuente: {b.get('url_fuente', '')}\n")
            for campo in ("texto", "notas_oficiales"):
                if a.get(campo) != b.get(campo):
                    partes.append(f"```diff\n{mini_diff(a.get(campo), b.get(campo))}\n```")
            partes.append("</details>")
        secciones.append("\n".join(partes))

    if not secciones:
        print("Sin cambios de contenido respecto de main.")
        sys.exit(3)

    cuerpo = ("## Cambios detectados en IMPO\n\n"
              f"**{totales['modificados']} artículos modificados, {totales['agregados']} agregados, "
              f"{totales['eliminados']} eliminados.**\n\n"
              "Revisá el detalle, mergeá a `main` y, cuando quieras publicarlo, corré el workflow "
              "\"Publicar datos en api\". Este PR no publica nada por sí solo.\n\n" + "\n\n".join(secciones))
    if len(cuerpo) > MAX_BODY:
        cuerpo = cuerpo[:MAX_BODY] + "\n\n… (resumen recortado; ver el diff completo en la pestaña Files)"
    Path(args.out).write_text(cuerpo, encoding="utf-8")
    print(cuerpo[:3000])


if __name__ == "__main__":
    main()
