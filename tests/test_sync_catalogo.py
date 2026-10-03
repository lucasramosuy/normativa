"""sync_catalogo: genera el catálogo de www y es idempotente."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/ingest/sync_catalogo.py"

LINEA = ("- La Constitución, 1 códigos y las leyes y decretos de `src/data/leyes.json` "
         "(1 normas al 01/01/2026; una norma aparece cuando sus datos llegan a `api`, "
         "que hoy publica 2 conjuntos de datos). Resto de la línea.\n")


def ley(i, extra=None):
    d = {"id": f"ley-{i}", "documento": f"Ley {i}", "tipo": "Ley", "numero": str(i), "anio": 2000,
         "corto": f"Corta {i}", "titulo_impo": f"TITULO {i}", "area": "Penal", "url": f"https://x/{i}"}
    d.update(extra or {})
    return d


class SyncCatalogoTest(unittest.TestCase):
    def armar(self, tmp, leyes, n_api=2):
        main, api, www = (Path(tmp) / x for x in ("main", "api", "www"))
        (main / "scripts/ingest").mkdir(parents=True)
        (api / "data").mkdir(parents=True)
        (www / "src/data").mkdir(parents=True)
        (main / "scripts/ingest/leyes.json").write_text(json.dumps(leyes), encoding="utf-8")
        (main / "scripts/ingest/codigos.json").write_text(json.dumps([{"id": "c"}]), encoding="utf-8")
        for i in range(n_api):
            (api / "data" / f"n{i}.jsonl").write_text("{}\n", encoding="utf-8")
        (www / "src/data/leyes.json").write_text("[]\n", encoding="utf-8")
        (www / "README.md").write_text("# web\n" + LINEA, encoding="utf-8")
        return main, api, www

    def correr(self, main, api, www):
        r = subprocess.run([sys.executable, str(SCRIPT), "--main", str(main), "--api", str(api), "--www", str(www)],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout

    def test_genera_y_es_idempotente(self):
        with tempfile.TemporaryDirectory() as tmp:
            main, api, www = self.armar(tmp, [ley(1, {"sin_texto_en_impo": True}), ley(2)])
            self.assertIn("cambios=true", self.correr(main, api, www))
            cat = json.loads((www / "src/data/leyes.json").read_text(encoding="utf-8"))
            self.assertEqual([x["id"] for x in cat], ["ley-1", "ley-2"])
            self.assertNotIn("documento", cat[0])
            self.assertNotIn("sin_texto_en_impo", cat[0])
            self.assertIn("(2 normas al ", (www / "README.md").read_text(encoding="utf-8"))
            self.assertIn("Resto de la línea.", (www / "README.md").read_text(encoding="utf-8"))
            antes = (www / "README.md").read_text(encoding="utf-8")
            self.assertIn("cambios=false", self.correr(main, api, www))
            self.assertEqual(antes, (www / "README.md").read_text(encoding="utf-8"))

    def test_sin_datos_en_api_falla(self):
        with tempfile.TemporaryDirectory() as tmp:
            main, api, www = self.armar(tmp, [ley(1)], n_api=0)
            r = subprocess.run([sys.executable, str(SCRIPT), "--main", str(main), "--api", str(api), "--www", str(www)],
                               capture_output=True, text=True)
            self.assertNotEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
