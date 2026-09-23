import fs from 'node:fs';
import path from 'node:path';

export type Article = {
  articulo: number | string; articulo_id?: string; capitulo?: string | null; documento: string; estado_actual?: string;
  fecha_publicacion?: string; fecha_promulgacion?: string; notas_oficiales?: string; seccion?: string | null;
  libro?: string | null; titulo_norma?: string | null; texto: string; titulo?: string; url_fuente: string;
};

export type Norma = {
  slug: string; nombre: string; corto: string; tipo: 'Constitución' | 'Código';
  descripcion: string; fuente: string;
};

export const NORMAS: Norma[] = [
  { slug: 'constitucion', nombre: 'Constitución de la República Oriental del Uruguay', corto: 'Constitución', tipo: 'Constitución', descripcion: 'Norma fundamental de la República. Texto de 1967 con las reformas plebiscitadas.', fuente: 'IMPO · Constitución 1967' },
  { slug: 'codigo-civil', nombre: 'Código Civil', corto: 'Código Civil', tipo: 'Código', descripcion: 'Personas, familia, bienes, obligaciones, contratos y sucesiones.', fuente: 'IMPO · Código Civil' },
  { slug: 'codigo-comercio', nombre: 'Código de Comercio', corto: 'Código de Comercio', tipo: 'Código', descripcion: 'Comerciantes, contratos comerciales, títulos y comercio marítimo.', fuente: 'IMPO · Código de Comercio' },
  { slug: 'codigo-penal', nombre: 'Código Penal', corto: 'Código Penal', tipo: 'Código', descripcion: 'Parte general del delito y la pena, y delitos en particular.', fuente: 'IMPO · Código Penal' },
  { slug: 'codigo-general-proceso', nombre: 'Código General del Proceso', corto: 'CGP', tipo: 'Código', descripcion: 'Proceso civil: principios, tribunales, actos procesales, prueba, recursos y ejecución.', fuente: 'IMPO · Código General del Proceso' },
  { slug: 'codigo-proceso-penal-2017', nombre: 'Código del Proceso Penal', corto: 'CPP 2017', tipo: 'Código', descripcion: 'Proceso penal acusatorio vigente desde 2017.', fuente: 'IMPO · Código del Proceso Penal (Ley 19.293)' },
  { slug: 'codigo-ninez-adolescencia', nombre: 'Código de la Niñez y la Adolescencia', corto: 'Niñez y Adolescencia', tipo: 'Código', descripcion: 'Derechos, deberes y protección de niños, niñas y adolescentes.', fuente: 'IMPO · Código de la Niñez y la Adolescencia' },
];

const cache = new Map<string, Article[]>();
export function getArticles(slug: string): Article[] {
  if (!cache.has(slug)) {
    const file = path.resolve(`data/${slug}.jsonl`);
    const rows: Article[] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    cache.set(slug, rows);
  }
  return cache.get(slug)!;
}
export const idOf = (a: Article) => String(a.articulo).toLowerCase();
export const labelOf = (a: Article) => String(a.articulo);
export const getNorma = (slug: string) => NORMAS.find(n => n.slug === slug)!;
export const totalArticles = () => NORMAS.reduce((n, x) => n + getArticles(x.slug).length, 0);
export const fmt = (n: number) => n.toLocaleString('es-UY');

/** Heading path for an article, top level first, without empty levels. */
export const headingsOf = (a: Article) => [a.libro, a.titulo_norma, a.seccion, a.capitulo].filter(Boolean) as string[];
export const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
export const slugify = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// compat for existing Constitución pages
export const articles = getArticles('constitucion').slice();
export const sections = [...new Set(articles.map(a => a.seccion).filter(Boolean))] as string[];
export const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
