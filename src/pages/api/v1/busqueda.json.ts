import { API_VERSION, NORMAS, getArticles, idOf, splitTitle, abs, json } from '../../../lib/api';

/**
 * GET /api/v1/busqueda.json: índice liviano para buscar del lado del cliente.
 * Sin texto de artículos: cada fila es [índice en `normas`, id del artículo, rubro o null].
 */
export function GET() {
  const filas = NORMAS.flatMap((n, i) => getArticles(n.slug).map(a => [i, idOf(a), splitTitle(a.texto).rubro ?? null]));
  return json({
    version: API_VERSION,
    documentacion: abs('api/#busqueda'),
    normas: NORMAS.map(n => ({ slug: n.slug, corto: n.corto, tipo: n.tipo })),
    columnas: ['norma', 'id', 'rubro'],
    total: filas.length,
    filas,
  });
}
