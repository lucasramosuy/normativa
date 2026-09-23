import type { APIContext } from 'astro';
import { API_VERSION, NORMAS, abs, json, articleLinks } from '../../../../lib/api';
import { getHistorial } from '../../../../data/historial';

export function getStaticPaths() {
  return NORMAS.map(n => ({ params: { norma: n.slug }, props: { norma: n } }));
}

/** GET /api/v1/historial/{norma}.json: published changes of that norma, newest first. */
export function GET({ props }: APIContext) {
  const n = (props as any).norma;
  const h = getHistorial(n.slug);
  return json({
    version: API_VERSION,
    documentacion: abs('api/#historial'),
    norma: n.slug,
    desde: h.desde,
    total: h.total,
    entradas: h.entradas.map(e => ({ ...e, html: articleLinks(n.slug, { articulo: e.articulo } as any)!.html })),
  });
}
