"""Regresión: el título Artículo Unico usa el ancla oficial 1 en IMPO."""
import importlib.util
import json
import tempfile
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("scrape_codigos", ROOT / "scripts/ingest/scrape_codigos.py")
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)


class PrepararNormasTest(unittest.TestCase):
    def test_tolerante_omite_placeholder_y_conserva_normas_completas(self):
        normas = [
            {"url": "https://www.impo.com.uy/bases/leyes/123-2020", "corto": "Pendiente", "area": "Civil"},
            {"id": "ley-123", "documento": "Ley 123", "url": "https://www.impo.com.uy/bases/leyes/123-2020"},
        ]
        self.assertEqual(scraper.preparar_normas(normas, tolerante=True), [normas[1]])

    def test_estricto_rechaza_placeholder_con_diagnostico(self):
        with self.assertRaisesRegex(SystemExit, "faltan campos id, documento"):
            scraper.preparar_normas([{"url": "https://example.invalid"}], tolerante=False)

    def test_tolerante_omite_entrada_no_objeto_sin_romper(self):
        norma = {"id": "ley-123", "documento": "Ley 123", "url": "https://example.invalid"}
        self.assertEqual(scraper.preparar_normas([None, norma], tolerante=True), [norma])


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


def cargar_modulo(nombre, relativo):
    spec = importlib.util.spec_from_file_location(nombre, ROOT / relativo)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def fila(articulo, texto, fecha):
    return {"documento": "Ley de prueba", "articulo": articulo, "texto": texto, "fecha_scraping": fecha}


class WriteOutputsTest(unittest.TestCase):
    """La revisión semanal no debe reescribir archivos cuando IMPO no cambió:
    si lo único nuevo es fecha_scraping, data/ y reports/ quedan byte a byte iguales
    y git no ve cambios (los PR dejaban de ser +19.579/-19.579)."""

    def correr_dos_veces(self, modulo, filas1, filas2, tmp):
        data = Path(tmp) / "data/ley-1.jsonl"
        reporte = Path(tmp) / "reports/last_run_ley-1.json"
        rep1 = {"documento": "Ley de prueba", "fecha_scraping": "2026-11-03T00:00:00Z"}
        rep2 = {"documento": "Ley de prueba", "fecha_scraping": "2026-11-10T00:00:00Z"}
        cambio1 = modulo.write_outputs(filas1, rep1, data, reporte)
        jsonl1 = data.read_text(encoding="utf-8")
        reporte1 = reporte.read_text(encoding="utf-8")
        cambio2 = modulo.write_outputs(filas2, rep2, data, reporte)
        return cambio1, cambio2, jsonl1, data.read_text(encoding="utf-8"), reporte1, reporte.read_text(encoding="utf-8")

    def probar_sin_cambios(self, modulo):
        with tempfile.TemporaryDirectory() as tmp:
            filas1 = [fila(1, "Uno.", "2026-11-03T00:00:00Z"), fila(2, "Dos.", "2026-11-03T00:00:00Z")]
            filas2 = [fila(1, "Uno.", "2026-11-10T00:00:00Z"), fila(2, "Dos.", "2026-11-10T00:00:00Z")]
            cambio1, cambio2, jsonl1, jsonl2, rep1, rep2 = self.correr_dos_veces(modulo, filas1, filas2, tmp)
        self.assertTrue(cambio1)  # primera escritura: el archivo no existía
        self.assertFalse(cambio2)
        self.assertEqual(jsonl1, jsonl2)  # conserva la fecha_scraping original
        self.assertIn("2026-11-03", jsonl2)
        self.assertEqual(rep1, rep2)  # el reporte tampoco se reescribe

    def probar_un_articulo_cambiado(self, modulo):
        with tempfile.TemporaryDirectory() as tmp:
            filas1 = [fila(1, "Uno.", "2026-11-03T00:00:00Z"), fila(2, "Dos.", "2026-11-03T00:00:00Z")]
            filas2 = [fila(1, "Uno.", "2026-11-10T00:00:00Z"), fila(2, "Dos actualizado.", "2026-11-10T00:00:00Z")]
            _, cambio2, _, jsonl2, _, rep2 = self.correr_dos_veces(modulo, filas1, filas2, tmp)
            lineas = jsonl2.splitlines()
            self.assertTrue(cambio2)
            self.assertIn("2026-11-03", json.loads(lineas[0])["fecha_scraping"])  # el art. 1 conserva su fecha
            self.assertIn("2026-11-10", json.loads(lineas[1])["fecha_scraping"])  # el art. 2 cambió de verdad
            self.assertIn("2026-11-10", rep2)  # el reporte sí se actualiza cuando hubo cambios

    def test_scrape_codigos_sin_cambios_no_reescribe(self):
        self.probar_sin_cambios(scraper)

    def test_scrape_codigos_conserva_fecha_solo_en_articulos_iguales(self):
        self.probar_un_articulo_cambiado(scraper)

    def test_scrape_constitucion_sin_cambios_no_reescribe(self):
        self.probar_sin_cambios(cargar_modulo("scrape_constitucion", "scripts/ingest/scrape_constitucion.py"))

    def test_scrape_constitucion_conserva_fecha_solo_en_articulos_iguales(self):
        self.probar_un_articulo_cambiado(cargar_modulo("scrape_constitucion", "scripts/ingest/scrape_constitucion.py"))


if __name__ == "__main__":
    unittest.main()
