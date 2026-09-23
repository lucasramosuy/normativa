"""Arma el historial de cambios por artículo a partir de lo publicado en la rama api.

Se corre desde el workflow "Publicar datos en api", dentro del checkout de api (con
historia completa), después de copiar los datos nuevos de main y antes de commitear.
Recorre los commits de api que tocaron data/*.jsonl, más la versión que se está por
publicar (el árbol de trabajo), y compara cada versión con la anterior artículo por
artículo. Solo cuenta lo publicado: los PRs abiertos o sin publicar no aparecen.

Escribe:
  historial/<norma>.json  entradas de esa norma (más nuevas primero)
  historial/index.json    resumen de todas las normas, para la página de cambios y el feed

La fecha "detectado" es la del commit de main que cambió el archivo (la corrida del
scraper). La fecha "publicado" es la del commit de api. Ninguna es la fecha de vigencia.

Uso (en el checkout de api):
  python historial.py --main ../main --main-sha <sha> --fecha <iso> [--repo owner/nombre]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
from pathlib import Path

IGNORAR = {"fecha_scraping", "hash_contenido"}
CAMPOS = ["texto", "notas_oficiales", "titulo", "libro", "titulo_norma", "seccion", "capitulo",
          "estado_actual", "url_fuente"]
GUARDAR = CAMPOS + ["articulo", "documento"]


def git(*args: str, cwd: str = ".") -> str:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True).stdout


def cargar(texto: str | None) -> dict[str, dict]:
    filas = {}
    for linea in (texto or "").splitlines():
        if linea.strip():
            r = json.loads(linea)
            filas[str(r["articulo"])] = r
    return filas


def limpio(r: dict) -> dict:
    return {k: v for k, v in r.items() if k not in IGNORAR}


def resumen(r: dict | None) -> dict | None:
    return None if r is None else {k: r.get(k) for k in GUARDAR if r.get(k) is not None}


def pr_de(sha: str, repo: str | None, cache: dict) -> dict | None:
    """PR mergeado que llevó ese commit de main, si lo hubo (vía gh api)."""
    if not repo or not sha:
        return None
    if sha not in cache:
        try:
            out = subprocess.run(["gh", "api", f"repos/{repo}/commits/{sha}/pulls"], capture_output=True,
                                 text=True, timeout=30)
            prs = [p for p in json.loads(out.stdout or "[]") if p.get("merged_at") and p.get("base", {}).get("ref") == "main"]
            cache[sha] = {"numero": prs[0]["number"], "url": prs[0]["html_url"], "titulo": prs[0]["title"]} if prs else None
        except Exception:
            cache[sha] = None
    return cache[sha]


def detectado(main_dir: str | None, sha: str, archivo: str) -> str | None:
    if not main_dir or not sha:
        return None
    try:
        return git("log", "-1", "--format=%aI", sha, "--", archivo, cwd=main_dir).strip() or None
    except subprocess.CalledProcessError:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--main", dest="main_dir", default=None, help="checkout de main con historia completa")
    ap.add_argument("--main-sha", default=None, help="sha de main que se está publicando ahora")
    ap.add_argument("--repo", default=None, help="owner/nombre, para enlazar PRs")
    ap.add_argument("--fecha", default=None, help="fecha ISO de esta publicación (la misma que se usa en el commit)")
    ap.add_argument("--out", default="historial")
    args = ap.parse_args()

    commits = [l.split("\t", 2) for l in git("log", "--reverse", "--format=%H\t%aI\t%s", "--", "data").splitlines() if l]
    versiones = []  # (ref o None=árbol, fecha publicado, sha de main)
    for sha, fecha, asunto in commits:
        m = re.search(r"desde main ([0-9a-f]{7,40})", asunto)
        versiones.append((sha, fecha, m.group(1) if m else None))
    pendiente = subprocess.run(["git", "status", "--porcelain", "--", "data"], capture_output=True, text=True).stdout.strip()
    if pendiente:
        ahora = args.fecha or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
        versiones.append((None, ahora, args.main_sha))

    archivos = sorted({p.name for p in Path("data").glob("*.jsonl")} |
                      {Path(l).name for sha, *_ in versiones if sha for l in git("ls-tree", "--name-only", sha, "data/").split()})
    out = Path(args.out)
    out.mkdir(exist_ok=True)
    prs: dict = {}
    indice = {"normas": {}, "recientes": []}

    for archivo in archivos:
        if not archivo.endswith(".jsonl"):
            continue
        norma = archivo[:-6]
        ruta = f"data/{archivo}"
        previo, entradas, desde = None, [], None
        for ref, publicado, msha in versiones:
            if ref is None:
                p = Path(ruta)
                txt = p.read_text(encoding="utf-8") if p.exists() else None
            else:
                try:
                    txt = git("show", f"{ref}:{ruta}")
                except subprocess.CalledProcessError:
                    txt = None
            actual = cargar(txt) if txt is not None else None
            if actual is None:
                continue
            if previo is None:
                previo, desde = actual, publicado
                continue
            base = {"publicado": publicado, "detectado": detectado(args.main_dir, msha, ruta) or publicado,
                    "main_sha": msha, "pr": pr_de(msha, args.repo, prs)}
            for k, r in actual.items():
                if k not in previo:
                    entradas.append({"articulo": k, "tipo": "agregado", "campos": [], "antes": None, "despues": resumen(r), **base})
                elif limpio(previo[k]) != limpio(r):
                    a, b = previo[k], r
                    campos = [c for c in CAMPOS if a.get(c) != b.get(c)] or ["otros"]
                    entradas.append({"articulo": k, "tipo": "modificado", "campos": campos, "antes": resumen(a), "despues": resumen(b), **base})
            for k, r in previo.items():
                if k not in actual:
                    entradas.append({"articulo": k, "tipo": "eliminado", "campos": [], "antes": resumen(r), "despues": None, **base})
            previo = actual
        entradas.sort(key=lambda e: e["publicado"], reverse=True)
        doc = {"norma": norma, "desde": desde, "total": len(entradas), "entradas": entradas}
        (out / f"{norma}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        indice["normas"][norma] = {"desde": desde, "total": len(entradas),
                                   "ultimo": entradas[0]["publicado"] if entradas else None}
        indice["recientes"] += [{"norma": norma, **{k: e[k] for k in ("articulo", "tipo", "campos", "publicado", "detectado", "pr")}} for e in entradas]

    indice["recientes"].sort(key=lambda e: e["publicado"], reverse=True)
    indice["recientes"] = indice["recientes"][:300]
    (out / "index.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"historial: {sum(v['total'] for v in indice['normas'].values())} entradas en {len(indice['normas'])} normas")


if __name__ == "__main__":
    main()
