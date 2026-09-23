import fs from 'node:fs';
import path from 'node:path';
import { diffWordsWithSpace } from 'diff';
import { NORMAS, getArticles, idOf, type Article } from './normas';

/** Change history generated in the api branch by scripts/ingest/historial.py (published changes only). */
export type Entrada = {
  articulo: string; tipo: 'modificado' | 'agregado' | 'eliminado'; campos: string[];
  antes: Partial<Article> | null; despues: Partial<Article> | null;
  publicado: string; detectado: string; main_sha: string | null;
  pr: { numero: number; url: string; titulo: string } | null;
};
export type Historial = { norma: string; desde: string | null; total: number; entradas: Entrada[] };

const cache = new Map<string, Historial>();
export function getHistorial(slug: string): Historial {
  if (!cache.has(slug)) {
    const file = path.resolve(`historial/${slug}.json`);
    const h: Historial = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { norma: slug, desde: null, total: 0, entradas: [] };
    cache.set(slug, h);
  }
  return cache.get(slug)!;
}

const key = (a: string | number) => String(a).toLowerCase();
export const entradasDe = (slug: string, articulo: string | number) =>
  getHistorial(slug).entradas.filter(e => key(e.articulo) === key(articulo));

/** Articles that were published once and no longer appear in IMPO: they keep a page with a notice. */
export function eliminados(slug: string): { article: Article; entrada: Entrada }[] {
  const vivos = new Set(getArticles(slug).map(idOf));
  const vistos = new Set<string>();
  const out: { article: Article; entrada: Entrada }[] = [];
  for (const e of getHistorial(slug).entradas) {
    const k = key(e.articulo);
    if (vistos.has(k)) continue;
    vistos.add(k);
    if (e.tipo === 'eliminado' && !vivos.has(k) && e.antes) out.push({ article: e.antes as Article, entrada: e });
  }
  return out;
}

export function recientes(limit = 200) {
  return NORMAS.flatMap(n => getHistorial(n.slug).entradas.map(e => ({ norma: n, e })))
    .sort((a, b) => b.e.publicado.localeCompare(a.e.publicado)).slice(0, limit);
}

/** Earliest "first version" date across normas (for "sin cambios desde ..."). */
export const desdeDe = (slug: string) => getHistorial(slug).desde;

const TZ = 'America/Montevideo';
export const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }) : '';
export const fechaLarga = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }) : '';

export const NOMBRE_CAMPO: Record<string, string> = {
  texto: 'texto', notas_oficiales: 'notas oficiales', titulo: 'título', libro: 'libro', titulo_norma: 'título de la norma',
  seccion: 'sección', capitulo: 'capítulo', estado_actual: 'estado', url_fuente: 'enlace a IMPO', otros: 'otros datos',
};
export const TIPO: Record<Entrada['tipo'], string> = { modificado: 'Modificado', agregado: 'Agregado', eliminado: 'Ya no figura en IMPO' };

/** Word-level diff as HTML (escaped), with <ins>/<del>. */
export function diffHtml(a = '', b = '') {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return diffWordsWithSpace(a, b).map(p => p.added ? `<ins>${esc(p.value)}</ins>` : p.removed ? `<del>${esc(p.value)}</del>` : esc(p.value)).join('');
}
