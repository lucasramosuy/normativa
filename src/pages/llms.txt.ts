import type { APIRoute } from 'astro';
import { NORMAS, getArticles, fmt, numeroOf } from '../data/normas';

const SITIO = 'https://lucasramos.uy/normativa/';

// Contexto para buscadores y asistentes con IA (estándar llms.txt): qué es el sitio y su mapa de normas.
export const GET: APIRoute = () => {
  const total = NORMAS.reduce((n, x) => n + getArticles(x.slug).length, 0);
  const normas = NORMAS.map(n => {
    const id = numeroOf(n);
    return `- [${n.titulo_impo ?? n.nombre}](${SITIO}normas/${n.slug}/): ${id ? `${id}, ${n.anio}. ` : `${n.tipo}. `}${fmt(getArticles(n.slug).length)} artículos.`;
  });
  const texto = [
    '# Normativa Uruguay',
    '',
    '> Biblioteca abierta de normativa uruguaya: Constitución, códigos, leyes y decretos con el texto completo por artículo, enlace a la fuente oficial en IMPO e historial de cambios publicados. La redacción oficial y vigente es siempre la de IMPO.',
    '',
    `${fmt(NORMAS.length)} normas y ${fmt(total)} artículos. Cada artículo tiene URL propia y cita la fuente oficial.`,
    '',
    '## Páginas',
    '',
    `- [Portada](${SITIO}): búsqueda global por texto o número de artículo.`,
    `- [Explorar](${SITIO}explorar/): catálogo de normas por tipo.`,
    `- [Buscar](${SITIO}buscar/): búsqueda con filtros.`,
    `- [Cambios](${SITIO}cambios/): últimos cambios publicados, con feed Atom en ${SITIO}cambios/feed.xml.`,
    `- [Fuentes y metodología](${SITIO}fuentes-y-metodologia/): cómo se obtiene y actualiza el texto.`,
    '',
    '## API abierta',
    '',
    `- [Documentación](${SITIO}api/): API estática JSON v1, sin clave, CORS abierto.`,
    `- [Contrato OpenAPI](${SITIO}api/openapi.json)`,
    `- [Índice de normas (JSON)](${SITIO}api/v1/normas.json)`,
    '',
    '## Normas',
    '',
    ...normas,
    '',
  ].join('\n');
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
