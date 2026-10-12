import type { APIContext } from 'astro';
import { API_VERSION, NORMAS, getArticles, idOf, abs, json, articleLinks } from '../../../../lib/api';
import { citadoPor } from '../../../../lib/citas';

export function getStaticPaths() {
  return NORMAS.map(n => ({ params: { norma: n.slug }, props: { norma: n } }));
}

/** GET /api/v1/citas/{norma}.json: por cada artículo de la norma, qué artículos del sitio lo citan. Solo aparecen los citados. */
export function GET({ props }: APIContext) {
  const n = (props as any).norma;
  const citados = getArticles(n.slug).flatMap(a => {
    const id = idOf(a);
    const lista = citadoPor(n.slug, id);
    if (!lista.length) return [];
    return [{
      id, ...articleLinks(n.slug, a)!,
      total: lista.length,
      citado_por: lista.map(c => ({ norma: c.slug, id: c.id, via: c.via, ...articleLinks(c.slug, { articulo: c.id } as any)! })),
    }];
  });
  return json({
    version: API_VERSION,
    documentacion: abs('api/#citas'),
    norma: n.slug,
    total_articulos_citados: citados.length,
    articulos: citados,
  });
}
