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

/* ---------- Article text formatting ---------- */
export type Block = { type: 'p'; text: string } | { type: 'list'; items: { marker: string; text: string }[] };
const MARKER = /^((?:[A-Za-z]|[0-9]{1,3}[°º]?|[IVXLC]{1,6})\))\s*([A-Za-zÁÉÍÓÚÑáéíóúñ¿\"“(].*)$/;

/** Splits the "(Legítima defensa).-" marginal title off the start of the text. */
export function splitTitle(texto: string): { rubro: string | null; body: string } {
  // The title can wrap onto several lines in IMPO, e.g. "(Incitación al odio ... hacia determinadas\npersonas)".
  const m = texto.match(/^\s*\(([^()]{2,200})\)\s*\.?\s*-?\s*/);
  if (!m || /^derogad/i.test(m[1])) return { rubro: null, body: texto.trim() };
  return { rubro: m[1].replace(/\s+/g, ' ').trim(), body: texto.slice(m[0].length).trim() };
}

/** Reflows IMPO hard-wrapped lines into paragraphs and enumerated lists. */
export function toBlocks(body: string): Block[] {
  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blocks: Block[] = [];
  let cur: { kind: 'p' | 'item'; text: string; marker?: string } | null = null;
  const flush = () => {
    if (!cur) return;
    if (cur.kind === 'p') blocks.push({ type: 'p', text: cur.text });
    else {
      const last = blocks[blocks.length - 1];
      const item = { marker: cur.marker!, text: cur.text };
      if (last && last.type === 'list') last.items.push(item); else blocks.push({ type: 'list', items: [item] });
    }
    cur = null;
  };
  for (const line of lines) {
    const m = line.match(MARKER);
    const ends = cur ? (/[.:]["”)]?$/.test(cur.text) && !/\b(?:arts?|inc|incs|num|lit|ley|Nº|N°|Dr|Sr|Sra|etc)\.$/i.test(cur.text)) || (cur.kind === 'item' && /;$/.test(cur.text)) : true;
    if (m && (ends || !cur || /[;,]$/.test(cur.text))) { flush(); cur = { kind: 'item', marker: m[1], text: m[2] }; continue; }
    if (cur && !ends) { cur.text += ' ' + line; continue; }
    flush(); cur = { kind: 'p', text: line };
  }
  flush();
  return blocks;
}

/** "LIBRO I - PARTE GENERAL" -> { level: "Libro I", name: "Parte general" } */
export function splitHeading(h: string): { level: string; name: string } {
  const m = h.match(/^\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-Z0-9ÚNICOPRELIMINAR]+)?)\s*[-–]\s*(.+)$/);
  const tidy = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (!m) return { level: tidy(h.trim()), name: '' };
  return { level: tidy(m[1]).replace(/\b([ivxlc]+)\b/g, r => r.toUpperCase()), name: m[2].trim() };
}
