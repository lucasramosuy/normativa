import fs from 'node:fs';
import path from 'node:path';
import leyesJson from './leyes.json';

export type Article = {
  articulo: number | string; articulo_id?: string; capitulo?: string | null; documento: string; estado_actual?: string;
  fecha_publicacion?: string; fecha_promulgacion?: string; notas_oficiales?: string; seccion?: string | null;
  libro?: string | null; titulo_norma?: string | null; texto: string; titulo?: string; url_fuente: string;
};

export type Tipo = 'Constitución' | 'Código' | 'Ley' | 'Decreto-ley' | 'Decreto';
export type Norma = {
  slug: string; nombre: string; corto: string; tipo: Tipo;
  descripcion: string; fuente: string;
  /** Leyes y decretos: número oficial ("19.580", "500/991"), año, área temática y título de IMPO. */
  numero?: string; anio?: number; area?: string; titulo_impo?: string; url?: string;
};

const CODIGOS: Norma[] = [
  { slug: 'constitucion', nombre: 'Constitución de la República Oriental del Uruguay', corto: 'Constitución', tipo: 'Constitución', descripcion: 'Norma fundamental de la República. Texto de 1967 con las reformas plebiscitadas.', fuente: 'IMPO · Constitución 1967' },
  { slug: 'codigo-civil', nombre: 'Código Civil', corto: 'Código Civil', tipo: 'Código', descripcion: 'Personas, familia, bienes, obligaciones, contratos y sucesiones.', fuente: 'IMPO · Código Civil' },
  { slug: 'codigo-comercio', nombre: 'Código de Comercio', corto: 'Código de Comercio', tipo: 'Código', descripcion: 'Comerciantes, contratos comerciales, títulos y comercio marítimo.', fuente: 'IMPO · Código de Comercio' },
  { slug: 'codigo-penal', nombre: 'Código Penal', corto: 'Código Penal', tipo: 'Código', descripcion: 'Parte general del delito y la pena, y delitos en particular.', fuente: 'IMPO · Código Penal' },
  { slug: 'codigo-general-proceso', nombre: 'Código General del Proceso', corto: 'CGP', tipo: 'Código', descripcion: 'Proceso civil: principios, tribunales, actos procesales, prueba, recursos y ejecución.', fuente: 'IMPO · Código General del Proceso' },
  { slug: 'codigo-proceso-penal-2017', nombre: 'Código del Proceso Penal', corto: 'CPP 2017', tipo: 'Código', descripcion: 'Proceso penal acusatorio vigente desde 2017.', fuente: 'IMPO · Código del Proceso Penal (Ley 19.293)' },
  { slug: 'codigo-ninez-adolescencia', nombre: 'Código de la Niñez y la Adolescencia', corto: 'Niñez y Adolescencia', tipo: 'Código', descripcion: 'Derechos, deberes y protección de niños, niñas y adolescentes.', fuente: 'IMPO · Código de la Niñez y la Adolescencia' },
  { slug: 'codigo-tributario', nombre: 'Código Tributario', corto: 'Código Tributario', tipo: 'Código', descripcion: 'Normas generales de los tributos: obligación tributaria, procedimiento, infracciones y recursos.', fuente: 'IMPO · Código Tributario (Decreto-ley 14.306)' },
  { slug: 'codigo-aduanero', nombre: 'Código Aduanero', corto: 'Código Aduanero', tipo: 'Código', descripcion: 'Régimen aduanero, operaciones de importación y exportación, infracciones y procedimiento.', fuente: 'IMPO · Código Aduanero (Ley 19.276)' },
  { slug: 'codigo-rural', nombre: 'Código Rural', corto: 'Código Rural', tipo: 'Código', descripcion: 'Propiedad rural, ganadería, marcas y señales, cercos, caminos y abigeato.', fuente: 'IMPO · Código Rural (Ley 10.024)' },
  { slug: 'codigo-aguas', nombre: 'Código de Aguas', corto: 'Código de Aguas', tipo: 'Código', descripcion: 'Dominio, uso y protección de las aguas y sus obras.', fuente: 'IMPO · Código de Aguas (Decreto-ley 14.859)' },
  { slug: 'codigo-aeronautico', nombre: 'Código Aeronáutico', corto: 'Código Aeronáutico', tipo: 'Código', descripcion: 'Aeronaves, aeródromos, personal aeronáutico, transporte aéreo y responsabilidad.', fuente: 'IMPO · Código Aeronáutico (Decreto-ley 14.305)' },
  { slug: 'codigo-mineria', nombre: 'Código de Minería', corto: 'Código de Minería', tipo: 'Código', descripcion: 'Yacimientos, títulos mineros, prospección, exploración y explotación.', fuente: 'IMPO · Código de Minería (Decreto-ley 15.242)' },
];

type LeyJson = { id: string; tipo: 'Ley' | 'Decreto-ley' | 'Decreto'; numero: string; anio: number; corto: string; titulo_impo: string; area: string; url: string };
const LEYES: Norma[] = (leyesJson as LeyJson[]).map(l => ({
  slug: l.id, corto: l.corto, tipo: l.tipo, numero: l.numero, anio: l.anio, area: l.area, titulo_impo: l.titulo_impo, url: l.url,
  nombre: `${l.corto} · ${l.tipo} ${l.numero}`,
  descripcion: `${l.tipo} ${l.numero}, ${l.anio}.`,
  fuente: `IMPO · ${l.tipo} ${l.numero}`,
}));

/** Solo las normas que tienen datos publicados: una norma nueva aparece en el sitio cuando llega a api. */
const conDatos = (n: Norma) => fs.existsSync(path.resolve(`data/${n.slug}.jsonl`));
export const NORMAS: Norma[] = [...CODIGOS, ...LEYES].filter(conDatos);

/** Grupos para Explorar y la portada, en orden de presentación. */
export const GRUPOS: { titulo: string; tipos: Tipo[] }[] = [
  { titulo: 'Constitución y códigos', tipos: ['Constitución', 'Código'] },
  { titulo: 'Leyes y decretos-ley', tipos: ['Ley', 'Decreto-ley'] },
  { titulo: 'Decretos reglamentarios', tipos: ['Decreto'] },
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
/** "Ley 19.580", "Decreto 500/991"; vacío para Constitución y códigos. */
export const numeroOf = (n: Norma) => n.numero ? `${n.tipo} ${n.numero}` : '';
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
// Text formatting lives in lib/texto.ts so the browser (e.g. /ficha/) can use it too.
export { splitTitle, toBlocks, type Block } from '../lib/texto';

/** "LIBRO I - PARTE GENERAL" -> { level: "Libro I", name: "Parte general" } */
export function splitHeading(h: string): { level: string; name: string } {
  const m = h.match(/^\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-Z0-9ÚNICOPRELIMINAR]+)?)\s*[-–]\s*(.+)$/);
  const tidy = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (!m) return { level: tidy(h.trim()), name: '' };
  return { level: tidy(m[1]).replace(/\b([ivxlc]+)\b/g, r => r.toUpperCase()), name: m[2].trim() };
}
