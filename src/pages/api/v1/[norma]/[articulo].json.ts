import type { APIContext } from 'astro';
import { API_VERSION, NORMAS, getArticles, idOf, splitTitle, abs, json, articleLinks } from '../../../../lib/api';

export function getStaticPaths() {
  return NORMAS.flatMap(n => {
    const list = getArticles(n.slug);
    return list.map((a, i) => ({
      params: { norma: n.slug, articulo: idOf(a) },
      props: { slug: n.slug, article: a, prev: list[i - 1] ?? null, next: list[i + 1] ?? null },
    }));
  });
}

/** GET /api/v1/{norma}/{articulo}.json: the full article record as published in the JSONL, plus links. */
export function GET({ props }: APIContext) {
  const { slug, article, prev, next } = props as any;
  const self = articleLinks(slug, article)!;
  return json({
    version: API_VERSION,
    documentacion: abs('api/'),
    norma: slug,
    id: self.id,
    rubro: splitTitle(article.texto).rubro,
    ...article,
    enlaces: { json: self.json, html: self.html, norma: abs(`api/v1/${slug}.json`), anterior: articleLinks(slug, prev), siguiente: articleLinks(slug, next) },
  });
}
