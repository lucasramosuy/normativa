"""alta_leyes: validación, completado desde IMPO e idempotencia."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("alta_leyes", ROOT / "scripts/ingest/alta_leyes.py")
alta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alta)

AREAS = {"Penal", "Civil y comercial"}


def minima(url, corto="Corta", area="Penal"):
    return {"url": url, "corto": corto, "area": area}


class CompletarTest(unittest.TestCase):
    def test_reproduce_entradas_existentes(self):
        """Completar la versión mínima de entradas reales da la entrada del repo."""
        reales = json.loads((ROOT / "scripts/ingest/leyes.json").read_text(encoding="utf-8"))
        for tipo in ("Ley", "Decreto-ley", "Decreto"):
            e = next(x for x in reales if x["tipo"] == tipo and "sin_texto_en_impo" not in x)
            datos = {"nroNorma": str(int(e["url"].rsplit("/", 1)[1].split("-")[0])),
                     "anioNorma": e["anio"], "nombreNorma": e["titulo_impo"]}
            obtenida = alta.completar(minima(e["url"], e["corto"], e["area"]), datos)
            self.assertEqual(obtenida, e, tipo)
            self.assertEqual(list(obtenida), list(e))

    def test_impo_no_coincide(self):
        with self.assertRaises(SystemExit):
            alta.completar(minima("https://www.impo.com.uy/bases/leyes/20376-2024"),
                           {"nroNorma": "20377", "anioNorma": 2024, "nombreNorma": "X"})

    def test_impo_sin_titulo(self):
        with self.assertRaises(SystemExit):
            alta.completar(minima("https://www.impo.com.uy/bases/leyes/20376-2024"),
                           {"nroNorma": "20376", "anioNorma": 2024, "nombreNorma": " "})

    def test_decreto_año_2000_en_adelante(self):
        self.assertEqual(alta.id_y_numero("Decreto", 12, 2005), ("decreto-12-2005", "12/005", "Decreto 12/005"))


class ValidarTest(unittest.TestCase):
    def test_valida(self):
        alta.validar([minima("https://www.impo.com.uy/bases/leyes/20376-2024")], AREAS)

    def test_rechaza(self):
        malos = [
            minima("https://www.impo.com.uy/bases/leyes/abc"),
            minima("https://example.com/bases/leyes/1-2000"),
            minima("https://www.impo.com.uy/bases/leyes/20376-2024", corto=" "),
            minima("https://www.impo.com.uy/bases/leyes/20376-2024", area="Inventada"),
        ]
        for m in malos:
            with self.assertRaises(SystemExit, msg=str(m)):
                alta.validar([m], AREAS)

    def test_repetidos(self):
        u = "https://www.impo.com.uy/bases/leyes/20376-2024"
        with self.assertRaises(SystemExit):
            alta.validar([minima(u), minima(u)], AREAS)


class SalidaTest(unittest.TestCase):
    def test_formato_leyes_json_igual_al_actual(self):
        ruta = ROOT / "scripts/ingest/leyes.json"
        entradas = json.loads(ruta.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "leyes.json"
            alta.escribir_leyes(out, entradas)
            self.assertEqual(out.read_text(encoding="utf-8"), ruta.read_text(encoding="utf-8"))

    def armar(self, tmp, n_data):
        root = Path(tmp)
        (root / "data").mkdir()
        (root / "scripts/ingest").mkdir(parents=True)
        (root / "scripts/ingest/codigos.json").write_text("[{}, {}]", encoding="utf-8")
        for i in range(n_data):
            (root / "data" / f"ley-{i}.jsonl").write_text("{}\n{}\n", encoding="utf-8")
        (root / "README.md").write_text(f"a\n{alta.MARCA_INI}\nAl 01/01/2020: viejo\n{alta.MARCA_FIN}\nb\n",
                                         encoding="utf-8")
        return root

    def test_readme_cuenta_desde_los_datos_y_es_idempotente(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.armar(tmp, 3)
            self.assertTrue(alta.actualizar_readme(root, 3))
            texto = (root / "README.md").read_text(encoding="utf-8")
            self.assertIn("2 códigos y 3 leyes y decretos", texto)
            self.assertIn("3 normas con datos en `main`, 6 artículos", texto)
            self.assertTrue(texto.startswith("a\n") and texto.endswith("b\n"))
            self.assertFalse(alta.actualizar_readme(root, 3))
            (root / "data/ley-9.jsonl").write_text("{}\n", encoding="utf-8")
            self.assertTrue(alta.actualizar_readme(root, 4))

    def test_readme_sin_marcas(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.armar(tmp, 1)
            (root / "README.md").write_text("sin marcas", encoding="utf-8")
            with self.assertRaises(SystemExit):
                alta.actualizar_readme(root, 1)


if __name__ == "__main__":
    unittest.main()
