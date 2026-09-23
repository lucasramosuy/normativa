import { API_VERSION, NORMAS, abs, json } from '../../../lib/api';
import { getHistorial, recientes } from '../../../data/historial';

/** GET /api/v1/historial.json: totals per norma plus the latest published changes (without texts). */
export function GET() {
  return json({
    version: API_VERSION,
    documentacion: abs('api/#historial'),
    normas: NORMAS.map(n => { const h = getHistorial(n.slug); return { norma: n.slug, desde: h.desde, total: h.total, ultimo: h.entradas[0]?.publicado ?? null, json: abs(`api/v1/historial/${n.slug}.json`) }; }),
    recientes: recientes(100).map(({ norma, e }) => ({ norma: norma.slug, articulo: e.articulo, tipo: e.tipo, campos: e.campos, publicado: e.publicado, detectado: e.detectado, pr: e.pr, html: abs(`normas/${norma.slug}/articulo/${e.articulo.toLowerCase()}/`) })),
  });
}
