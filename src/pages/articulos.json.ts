import { NORMAS, getArticles, idOf } from '../data/normas';
/** Compact list of article ids per norma, used by /buscar/ for direct article lookup. */
export function GET() {
  const ids: Record<string, string[]> = {};
  for (const n of NORMAS) ids[n.slug] = getArticles(n.slug).map(idOf);
  return new Response(JSON.stringify({ normas: NORMAS.map(n => ({ slug: n.slug, corto: n.corto })), ids }), { headers: { 'Content-Type': 'application/json' } });
}
