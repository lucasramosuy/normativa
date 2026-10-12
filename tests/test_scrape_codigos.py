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

    def test_normalizar_id_conserva_guion_antes_de_letra_final(self):
        self.assertEqual(scraper.normalizar_id_articulo("26-BIS-A"), "26BIS-A")
        self.assertEqual(scraper.normalizar_id_articulo("149-BIS"), "149BIS")
        self.assertEqual(scraper.normalizar_id_articulo("131-144"), "131144")

    def test_rango_con_guion_en_el_ancla_conserva_el_guion(self):
        html = (
            '<html><body>'
            '<a id="8" name="8"></a><h4>Artículo 8</h4><pre>Texto ocho.</pre>'
            '<a id="9-12" name="9-12"></a><h4>Artículo 9--12</h4><pre>Texto del rango.</pre>'
            '<a id="13" name="13"></a><h4>Artículo 13</h4><pre>Texto trece.</pre>'
            '</body></html>'
        )
        rows, report = scraper.parse_norma(html, "Ley de prueba", "https://www.impo.com.uy/bases/leyes/17835-2004", "2026-10-12T00:00:00Z")
        self.assertEqual([r["articulo_id"] for r in rows], ["8", "9-12", "13"])
        self.assertEqual(rows[1]["articulo"], "9-12")
        self.assertEqual(rows[1]["titulo"], "Artículo 9-12")
        self.assertTrue(rows[1]["url_fuente"].endswith("/9-12"))
        self.assertEqual(report["faltantes"], 0)

    def test_rango_sin_guion_en_el_ancla_sigue_igual(self):
        html = '<html><body><a id="131144" name="131144"></a><h4>Artículo 131-144</h4><pre>Derogados.</pre></body></html>'
        rows, _ = scraper.parse_norma(html, "Ley de prueba", "https://example.invalid", "2026-10-12T00:00:00Z")
        self.assertEqual(rows[0]["articulo_id"], "131144")


if __name__ == "__main__":
    unittest.main()
