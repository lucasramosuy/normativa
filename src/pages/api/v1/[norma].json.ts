import type { APIContext } from 'astro';
import { API_VERSION, NORMAS, getArticles, idOf, splitTitle, abs, json, normaSummary, articleLinks } from '../../../lib/api';

export function getStaticPaths() {
  return NORMAS.map(n => ({ params: { norma: n.slug }, props: { norma: n } }));
}

/** GET /api/v1/{norma}.json: norma metadata plus the index of its articles (without the full text). */
export function GET({ props }: APIContext) {
  const n = (props as any).norma;
  const list = getArticles(n.slug);
  return json({
    version: API_VERSION,
    documentacion: abs('api/'),
    norma: normaSummary(n),
    articulos: list.map(a => ({
      ...articleLinks(n.slug, a)!,
      articulo: a.articulo,
      titulo: a.titulo ?? null,
      rubro: splitTitle(a.texto).rubro,
      libro: a.libro ?? null,
      titulo_norma: a.titulo_norma ?? null,
      seccion: a.seccion ?? null,
      capitulo: a.capitulo ?? null,
      url_fuente: a.url_fuente,
    })),
  });
}
