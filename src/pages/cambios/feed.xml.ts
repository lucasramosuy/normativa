import { recientes, fechaLarga, NOMBRE_CAMPO, TIPO } from '../../data/historial';
import { abs } from '../../lib/api';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Atom feed of published article changes (newest first). */
export function GET() {
  const items = recientes(100);
  const updated = items[0]?.e.publicado ?? '2026-09-23T00:00:00Z';
  const entries = items.map(({ norma, e }) => {
    const link = abs(`normas/${norma.slug}/articulo/${e.articulo.toLowerCase()}/#historial`);
    const detalle = e.tipo === 'modificado' ? `Cambió: ${e.campos.map(c => NOMBRE_CAMPO[c] || c).join(', ')}.` : `${TIPO[e.tipo]}.`;
    return `<entry><id>${esc(`${link.replace('#historial', '')}#${e.publicado}`)}</id><title>${esc(`${norma.corto}, artículo ${e.articulo}: ${TIPO[e.tipo].toLowerCase()}`)}</title><link href="${esc(link)}"/><updated>${esc(new Date(e.publicado).toISOString())}</updated><summary>${esc(`${detalle} Detectado en IMPO y publicado en Normativa el ${fechaLarga(e.publicado)}.`)}</summary></entry>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es-UY">
<title>Cambios recientes · Normativa Uruguay</title>
<subtitle>Artículos modificados, agregados o quitados en IMPO.</subtitle>
<id>${abs('cambios/')}</id>
<link href="${abs('cambios/')}"/>
<link rel="self" href="${abs('cambios/feed.xml')}"/>
<updated>${new Date(updated).toISOString()}</updated>
<author><name>Normativa Uruguay</name></author>
${entries}
</feed>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
