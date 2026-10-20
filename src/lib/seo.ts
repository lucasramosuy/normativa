import { numeroOf, type Article, type Norma } from '../data/normas';
import { desdeDe, ultimaArticuloDe, ultimaDe } from '../data/historial';

const SITIO = 'https://lucasramos.uy/normativa/';
const IMPO = { '@type': 'Organization', name: 'IMPO', url: 'https://www.impo.com.uy' };
const URUGUAY = { '@type': 'AdministrativeArea', name: 'Uruguay' };

const dia = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);

/** JSON-LD Legislation para la página de una norma. La fecha es la del último cambio publicado en Normativa. */
export function normaJsonLd(norma: Norma) {
  const url = `${SITIO}normas/${norma.slug}/`;
  const modificada = dia(ultimaDe(norma.slug));
  return {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    '@id': url,
    name: norma.titulo_impo ?? norma.nombre,
    alternateName: norma.corto,
    legislationType: norma.tipo,
    ...(norma.numero ? { legislationIdentifier: numeroOf(norma) } : {}),
    jurisdiction: URUGUAY,
    inLanguage: 'es-UY',
    isAccessibleForFree: true,
    url,
    publisher: IMPO,
    ...(modificada ? { dateModified: modificada } : {}),
  };
}

/** JSON-LD Legislation para la página de un artículo, como parte de su norma. */
export function articuloJsonLd(norma: Norma, article: Article, label: string) {
  const normaUrl = `${SITIO}normas/${norma.slug}/`;
  const url = `${normaUrl}articulo/${String(article.articulo).toLowerCase()}/`;
  // Si el artículo nunca cambió, la fecha es la de incorporación de la norma, no la de un cambio ajeno.
  const modificada = dia(ultimaArticuloDe(norma.slug, article.articulo) ?? desdeDe(norma.slug));
  return {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    '@id': url,
    name: `${norma.titulo_impo ?? norma.nombre}, artículo ${label}`,
    alternateName: `${norma.corto}, art. ${label}`,
    legislationType: norma.tipo,
    ...(norma.numero ? { legislationIdentifier: `${numeroOf(norma)}, art. ${label}` } : {}),
    isPartOf: { '@type': 'Legislation', name: norma.titulo_impo ?? norma.nombre, url: normaUrl },
    jurisdiction: URUGUAY,
    inLanguage: 'es-UY',
    isAccessibleForFree: true,
    url,
    publisher: IMPO,
    sameAs: article.url_fuente,
    ...(modificada ? { dateModified: modificada } : {}),
  };
}

export type Miga = { nombre: string; url: string };

export const migasBase: Miga[] = [
  { nombre: 'Inicio', url: SITIO },
  { nombre: 'Explorar', url: `${SITIO}explorar/` },
];

export const migasNorma = (norma: Norma): Miga[] => [
  ...migasBase,
  { nombre: norma.corto, url: `${SITIO}normas/${norma.slug}/` },
];

export const migasArticulo = (norma: Norma, article: Article, label: string): Miga[] => [
  ...migasNorma(norma),
  { nombre: `Artículo ${label}`, url: `${SITIO}normas/${norma.slug}/articulo/${String(article.articulo).toLowerCase()}/` },
];

export function breadcrumbJsonLd(migas: Miga[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.nombre, item: m.url })),
  };
}
