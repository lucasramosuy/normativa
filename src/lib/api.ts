import { NORMAS, getArticles, idOf, splitTitle, type Article, type Norma } from '../data/normas';

export const API_VERSION = 1;
const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
const origin = (import.meta.env.SITE || 'https://lucasramos.uy').replace(/\/$/, '');
/** Absolute URL under the site base, e.g. abs('api/v1/normas.json'). */
export const abs = (p: string) => `${origin}${base}${p}`;
export const RAW_JSONL = (slug: string) => `https://raw.githubusercontent.com/lucasramosuy/normativa/api/data/${slug}.jsonl`;

export const json = (data: unknown) =>
  new Response(JSON.stringify(data, null, 2) + '\n', { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const latest = (list: Article[]) =>
  list.map(a => (a as any).fecha_scraping as string | undefined).filter(Boolean).sort().at(-1) ?? null;

export function normaSummary(n: Norma) {
  const list = getArticles(n.slug);
  return {
    slug: n.slug, nombre: n.nombre, corto: n.corto, tipo: n.tipo, descripcion: n.descripcion, fuente: n.fuente,
    articulos: list.length,
    actualizado: latest(list),
    json: abs(`api/v1/${n.slug}.json`),
    jsonl: RAW_JSONL(n.slug),
    html: abs(`normas/${n.slug}/`),
  };
}

export function articleLinks(slug: string, a: Article | null) {
  if (!a) return null;
  const id = idOf(a);
  return { id, json: abs(`api/v1/${slug}/${id}.json`), html: abs(`normas/${slug}/articulo/${id}/`) };
}

export { NORMAS, getArticles, idOf, splitTitle };
