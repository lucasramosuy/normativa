"""Regresión: el título Artículo Unico usa el ancla oficial 1 en IMPO."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("scrape_codigos", ROOT / "scripts/ingest/scrape_codigos.py")
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)


class ArticuloUnicoTest(unittest.TestCase):
    def test_articulo_unico_respeta_ancla_y_titulo(self):
        html = (ROOT / "tests/fixtures/articulo-unico.html").read_text(encoding="utf-8")
        rows, report = scraper.parse_norma(html, "Ley 19.430", "https://www.impo.com.uy/bases/leyes/19430-2016", "2026-09-30T23:00:00Z")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["articulo"], 1)
        self.assertEqual(rows[0]["articulo_id"], "1")
        self.assertEqual(rows[0]["titulo"], "Artículo Unico")
        self.assertTrue(rows[0]["url_fuente"].endswith("/1"))
        self.assertIn("Convención Interamericana", rows[0]["texto"])
        self.assertEqual(report["articulos_esperados_segun_impo"], 1)
        self.assertEqual(report["duplicados"], 0)
        self.assertEqual(report["faltantes"], 0)

    def test_sin_ancla_no_inventa_indice(self):
        with self.assertRaises(RuntimeError):
            scraper.parse_norma('<h4>Artículo Unico</h4><pre>Texto</pre>', 'Ley de prueba', 'https://example.invalid', '2026-09-30')


if __name__ == "__main__":
    unittest.main()
