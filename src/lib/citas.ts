// Referencias cruzadas: para cada artículo, qué otros artículos del sitio lo citan.
// Se calcula una vez durante el build a partir del texto y de las notas oficiales de IMPO.
// Deja afuera a propósito lo ambiguo ("el artículo anterior", "la ley citada") y lo que
// cita normas que no están en el sitio.
import { NORMAS, getArticles, idOf } from '../data/normas';

export type Cita = { slug: string; id: string; via: 'texto' | 'notas' | 'ambos' };

const CODIGOS_POR_NOMBRE: [RegExp, string][] = [
  [/^c[óo]digo civil/i, 'codigo-civil'],
  [/^c[óo]digo de comercio/i, 'codigo-comercio'],
  [/^c[óo]digo penal/i, 'codigo-penal'],
  [/^c[óo]digo general del proceso/i, 'codigo-general-proceso'],
  [/^c[óo]digo del proceso penal/i, 'codigo-proceso-penal-2017'],
  [/^c[óo]digo tributario/i, 'codigo-tributario'],
  [/^c[óo]digo de la niñez y (la )?adolescencia/i, 'codigo-ninez-adolescencia'],
  [/^c[óo]digo aduanero/i, 'codigo-aduanero'],
  [/^c[óo]digo aeron[áa]utico/i, 'codigo-aeronautico'],
  [/^c[óo]digo de aguas/i, 'codigo-aguas'],
  [/^c[óo]digo de miner[íi]a/i, 'codigo-mineria'],
  [/^c[óo]digo rural/i, 'codigo-rural'],
  [/^constituci[óo]n/i, 'constitucion'],
];

let alias: Map<string, string> | null = null;
let ids: Map<string, Set<string>> | null = null;

function init() {
  if (alias) return;
  alias = new Map(); ids = new Map();
  for (const n of NORMAS) {
    const list = getArticles(n.slug);
    ids.set(n.slug, new Set(list.map(idOf)));
    const s = n.slug;
    if (s.startsWith('ley-')) alias.set(`ley|${s.slice(4)}`, s);
    else if (s.startsWith('decreto-ley-')) alias.set(`dl|${s.slice(12)}`, s);
    else if (s.startsWith('decreto-')) { const [num, anio] = s.slice(8).split('-'); alias.set(`dec|${num}/${anio.slice(-3)}`, s); }
    // Los códigos se citan también por la ley que los aprobó (Código Civil = Ley 16.603).
    const m = /\/bases\/[^/]+\/(\d+)-\d{4}/.exec(list[0]?.url_fuente || '');
    if (s.startsWith('codigo') && m && !alias.has(`ley|${m[1]}`)) alias.set(`ley|${m[1]}`, s);
  }
}

const existe = (slug: string, id: string) => !!ids!.get(slug)?.has(id);

/** "Ley Nº 19.889", "Decreto Ley 14.294", "Decreto Nº 500/991", "Código Civil", "presente ley"… → slug o null. */
function normaDe(txt: string, propia: string): string | null {
  const t = txt.replace(/\s+/g, ' ').trim();
  if (/^(presente|este|esta)\b/i.test(t)) return propia;
  const m = /^(decreto[ -]ley|ley|decreto)\s+n?[º°o]?\.?\s*([\d.]+(?:\/\d+)?)/i.exec(t);
  if (m) {
    const tipo = m[1].toLowerCase().replace('-', ' '); const num = m[2].replace(/\.$/, '').replace(/\./g, '');
    if (tipo === 'decreto ley') return alias!.get(`dl|${num}`) ?? null;
    if (tipo === 'ley') return alias!.get(`ley|${num}`) ?? null;
    const d = /^(\d+)\/(\d+)$/.exec(num); return d ? alias!.get(`dec|${d[1]}/${d[2].slice(-3)}`) ?? null : null;
  }
  for (const [re, slug] of CODIGOS_POR_NOMBRE) if (re.test(t)) return slug;
  return null;
}

const NUM = String.raw`\d+(?:\s?[º°])?(?:\s?-?\s?(?:bis|ter|quater|qu[áa]ter)\b)?`;
/** "10, 11 y 12 bis" / "30 a 33" → ['10','11','12-bis'] / ['30','31','32','33']. */
function numeros(lista: string): string[] {
  const out: string[] = [];
  const clean = lista.replace(/[º°]/g, '');
  const rango = /^\s*(\d+)\s+a\s+(\d+)\s*$/.exec(clean);
  if (rango) { const a = +rango[1], b = +rango[2]; if (b > a && b - a <= 30) { for (let i = a; i <= b; i++) out.push(String(i)); return out; } }
  for (const m of clean.matchAll(/(\d+)(?:\s?-?\s?(bis|ter|quater|qu[áa]ter)\b)?/gi)) out.push(m[2] ? `${m[1]}-${m[2].toLowerCase().replace('á', 'a')}` : m[1]);
  return out;
}

const LISTA = String.raw`(${NUM}(?:\s?(?:,|y|e)\s?${NUM})*|\d+\s+a\s+\d+)`;
const NORMA_TXT = String.raw`(?:Decreto[ -]Ley|Ley|Decreto)\s+N?[º°o]?\.?\s*[\d.]+(?:\/\d+)?|C[óo]digo\s+(?:Civil|de\s+Comercio|Penal|General\s+del\s+Proceso|Tributario|de\s+la\s+Niñez\s+y\s+(?:la\s+)?Adolescencia|Aduanero|Aeron[áa]utico|de\s+Aguas|de\s+Miner[íi]a|Rural|del\s+Proceso\s+Penal)|Constituci[óo]n(?:\s+de\s+la\s+Rep[úu]blica)?|presente\s+(?:ley|c[óo]digo|decreto)|este\s+c[óo]digo|esta\s+ley`;
const RE_EXPLICITA = new RegExp(String.raw`art[íi]culos?\s+${LISTA}(?:\s+y\s+siguientes)?\s*,?\s*(?:de\s+la|del|de\s+el)\s+(${NORMA_TXT})`, 'gi');
const RE_SUELTA = new RegExp(String.raw`art[íi]culos?\s+${LISTA}`, 'gi');
// Lo que sigue a un "artículo N" suelto y lo vuelve ambiguo o ajeno: se descarta.
const DESPUES_AMBIGUO = /^\s*(?:y\s+siguientes\s*)?,?\s*(?:anterior|precedente|siguiente|citad|mencionad|que antecede|de\s+la\b|del\b|de\s+(?:esa|dicha|aquella)\b)/i;

/** ¿La posición cae dentro de un texto entre comillas? (redacciones que una ley le da a otra). */
function entreComillas(tx: string, pos: number) {
  const antes = tx.slice(0, pos);
  const rectas = (antes.match(/"/g) || []).length;
  const abre = (antes.match(/[“«]/g) || []).length, cierra = (antes.match(/[”»]/g) || []).length;
  return rectas % 2 === 1 || abre > cierra;
}

function citasDelTexto(slug: string, id: string, tx: string, add: (s: string, i: string) => void) {
  const esLey = !slug.startsWith('codigo') && slug !== 'constitucion';
  const tomados: [number, number][] = [];
  for (const m of tx.matchAll(RE_EXPLICITA)) {
    tomados.push([m.index!, m.index! + m[0].length]);
    const destino = normaDe(m[2], slug);
    if (!destino) continue;
    // "de la presente ley" dentro de una redacción entre comillas se refiere a la otra ley: se descarta.
    if (destino === slug && esLey && /^(presente|este|esta)/i.test(m[2].trim()) && entreComillas(tx, m.index!)) continue;
    for (const n of numeros(m[1])) add(destino, n);
  }
  for (const m of tx.matchAll(RE_SUELTA)) {
    if (tomados.some(([a, b]) => m.index! >= a && m.index! < b)) continue;
    if (DESPUES_AMBIGUO.test(tx.slice(m.index! + m[0].length, m.index! + m[0].length + 60))) continue;
    if (esLey && entreComillas(tx, m.index!)) continue;
    for (const n of numeros(m[1])) add(slug, n);
  }
}

/** Une las líneas cortadas de las notas igual que la página del artículo. */
export function lineasNotas(notas?: string | null): string[] {
  return (notas || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).reduce((acc: string[], l) => {
    const prev = acc[acc.length - 1];
    if (prev !== undefined && !/[.,:)]$/.test(prev) && !/^TEXTO ORIGINAL/i.test(l)) acc[acc.length - 1] = prev + ' ' + l; else acc.push(l);
    return acc;
  }, []);
}

const RE_NOTA_LEY = /(Decreto[ -]Ley|Ley|Decreto)\s+N[º°o]\.?\s*([\d.]+(?:\/\d+)?)\s+de\s+\d\d\/\d\d\/\d{4}\s*,?\s*art[íi]culos?\s+([\d\sa-zA-Z,-]+?)(?=\s*(?:[.;(]|incis|literal|numeral|$))/gi;
const RE_NOTA_COD = /(C[óo]digo [A-Za-zÁÉÍÓÚáéíóúñ ]+?|Constituci[óo]n de la Rep[úu]blica)\s+de\s+\d\d\/\d\d\/\d{4}\s*,?\s*art[íi]culos?\s+([\d\sa-zA-Z,-]+?)(?=\s*(?:[.;(]|incis|literal|numeral|$))/gi;
// Tipos de nota que son citas. Las de modificación (redacción dada por, derogado por, agregado por…),
// "TEXTO ORIGINAL", fe de erratas y denominaciones no cuentan como "citado por".
const NOTA_CITA = /^(ver\b|ver además|concordancia)/i;

function citasDeNotas(slug: string, notas: string | undefined | null, add: (s: string, i: string) => void) {
  for (const l of lineasNotas(notas)) {
    if (!NOTA_CITA.test(l)) continue;
    if (/^ver en esta norma/i.test(l)) {
      const lista = l.split(':').slice(1).join(':');
      // Las remisiones al artículo de vigencia se repiten en casi toda la norma: no aportan.
      for (const m of lista.matchAll(/(\d+(?:\s?-\s?(?:bis|ter))?)\s*(\(vigencia\))?/gi)) if (!m[2]) numeros(m[1]).forEach(n => add(slug, n));
      continue;
    }
    for (const m of l.matchAll(RE_NOTA_LEY)) { const d = normaDe(`${m[1]} ${m[2]}`, slug); if (d) numeros(m[3]).forEach(n => add(d, n)); }
    for (const m of l.matchAll(RE_NOTA_COD)) { const d = normaDe(m[1], slug); if (d) numeros(m[2]).forEach(n => add(d, n)); }
  }
}

let indice: Map<string, Cita[]> | null = null;

function construir() {
  init();
  const acc = new Map<string, Map<string, Cita>>();
  for (const n of NORMAS) {
    for (const a of getArticles(n.slug)) {
      const origen = idOf(a);
      const agregar = (via: 'texto' | 'notas') => (destSlug: string, destId: string) => {
        if (destSlug === n.slug && destId === origen) return;
        if (!existe(destSlug, destId)) return;
        const k = `${destSlug}/${destId}`; const src = `${n.slug}/${origen}`;
        let m = acc.get(k); if (!m) acc.set(k, m = new Map());
        const prev = m.get(src);
        m.set(src, { slug: n.slug, id: origen, via: prev && prev.via !== via ? 'ambos' : via });
      };
      citasDelTexto(n.slug, origen, a.texto || '', agregar('texto'));
      citasDeNotas(n.slug, a.notas_oficiales, agregar('notas'));
    }
  }
  const orden = new Map(NORMAS.map((n, i) => [n.slug, i]));
  const clave = (id: string) => { const m = /^(\d+)(.*)$/.exec(id); return m ? [+m[1], m[2]] as const : [Infinity, id] as const; };
  indice = new Map();
  for (const [k, m] of acc) {
    indice.set(k, [...m.values()].sort((x, y) => (orden.get(x.slug)! - orden.get(y.slug)!) || (clave(x.id)[0] - clave(y.id)[0]) || String(clave(x.id)[1]).localeCompare(String(clave(y.id)[1]))));
  }
}

/** Artículos que citan a slug/id, ordenados por norma y número. */
export function citadoPor(slug: string, id: string): Cita[] {
  if (!indice) construir();
  return indice!.get(`${slug}/${id}`) ?? [];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Una línea de las notas oficiales como HTML, con enlaces a los artículos que están en el sitio. */
export function enlazarNota(linea: string, slug: string, base: string, actual?: string): string {
  init();
  const link = (s: string, n: string, txt: string) => existe(s, n) && !(s === slug && n === actual) ? `<a href="${base}normas/${s}/articulo/${n}/">${txt}</a>` : txt;
  if (/^Ver en esta norma/i.test(linea)) {
    const [cab, ...resto] = linea.split(':');
    return esc(cab) + (resto.length ? ':' + esc(resto.join(':')).replace(/\b(\d+)(\s?-\s?(?:bis|ter))?\b/gi, (m, d, suf) => link(slug, suf ? `${d}-${suf.replace(/[\s-]/g, '').toLowerCase()}` : d, m)) : '');
  }
  let html = esc(linea);
  const numerosLinks = (lista: string, destino: string) => lista.replace(/(\d+)(\s?-\s?(?:bis|ter))?/gi, (m, d, suf) => link(destino, suf ? `${d}-${suf.replace(/[\s-]/g, '').toLowerCase()}` : d, m));
  html = html.replace(RE_NOTA_LEY, (m, tipo, num, lista) => {
    const d = normaDe(`${tipo} ${num}`, slug); if (!d) return m;
    const i = m.lastIndexOf(lista); return m.slice(0, i) + numerosLinks(lista, d) + m.slice(i + lista.length);
  });
  html = html.replace(RE_NOTA_COD, (m, nombre, lista) => {
    const d = normaDe(nombre, slug); if (!d) return m;
    const i = m.lastIndexOf(lista); return m.slice(0, i) + numerosLinks(lista, d) + m.slice(i + lista.length);
  });
  return html;
}

let porId: Map<string, Map<string, import('../data/normas').Article>> | null = null;
/** El artículo slug/id (para mostrar su rubro en la lista). */
export function articuloDe(slug: string, id: string) {
  if (!porId) { porId = new Map(); for (const n of NORMAS) porId.set(n.slug, new Map(getArticles(n.slug).map(a => [idOf(a), a]))); }
  return porId.get(slug)?.get(id);
}
