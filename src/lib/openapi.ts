import { abs, API_VERSION, NORMAS, normaSummary } from './api';
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const str = { type: 'string' };
const nullable = { type: 'string', nullable: true };
const uri = { type: 'string', format: 'uri' };
const date = { type: 'string', format: 'date-time' };
const maybeDate = { ...date, nullable: true };
const array = (items: object) => ({ type: 'array', items });
const object = (properties: object, required: string[] = Object.keys(properties)) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const envelope = { version: { type: 'integer', enum: [API_VERSION] }, documentacion: uri };
const location = { libro: nullable, titulo_norma: nullable, seccion: nullable, capitulo: nullable };
const linkProperties = { id: str, json: uri, html: uri };
const articleProperties = {
  articulo: { oneOf: [{ type: 'integer' }, str], description: 'Número o etiqueta de IMPO. Puede ser 149-bis o un rango como 131-144.' },
  articulo_id: str, documento: str, estado_actual: str, fecha_publicacion: { ...nullable, description: 'Fecha de IMPO en DD/MM/AAAA, no ISO. Puede ser null.' },
  fecha_promulgacion: { ...str, description: 'Fecha de IMPO en DD/MM/AAAA, cuando está disponible.' },
  fecha_scraping: date, hash_contenido: str, notas_oficiales: nullable, texto: str, titulo: str, url_fuente: uri, ...location,
};
const pr = { ...object({ numero: { type: 'integer' }, url: uri, titulo: str }), nullable: true };
const changeProperties = {
  articulo: str, tipo: { type: 'string', enum: ['modificado', 'agregado', 'eliminado'] }, campos: array(str),
  publicado: date, detectado: date, pr, html: uri,
};
const normaParameter = { name: 'norma', in: 'path', required: true, description: 'Slug del catálogo publicado, no el número de la ley.', schema: { type: 'string', enum: NORMAS.map(n => n.slug) }, example: 'constitucion' };
const articleParameter = { name: 'articulo', in: 'path', required: true, description: 'Usá el id del índice de la norma, en minúsculas. Admite bis, ter y rangos.', schema: str, example: '7' };
const operation = (operationId: string, summary: string, description: string, schema: string, parameters: object[] = []) => ({
  get: { operationId, summary, description, tags: [schema.startsWith('Historial') ? 'Historial' : 'Normas'], parameters,
    responses: { '200': { description: 'JSON publicado. Los metadatos y el texto no certifican la vigencia jurídica.', content: { 'application/json': { schema: ref(schema) } } },
      '404': { description: 'Recurso no publicado. El servidor estático puede responder HTML, no un objeto JSON de error.', content: { 'text/html': { schema: str } } } },
  },
});
/** Contrato generado junto al sitio: los slugs salen de los datos de api. */
export const openapi = {
  openapi: '3.0.3',
  info: { title: 'Normativa Uruguay · API', version: '1.0.0', description: 'API estática, pública y de solo lectura. Sin clave ni paginación. Solo cambios publicados; las fechas de descarga y publicación del historial no son fechas de vigencia. Los textos provienen de IMPO: ante diferencias, rige la fuente oficial. La publicación de datos es manual.' },
  servers: [{ url: abs('api/v1'), description: 'API pública v1' }],
  tags: [{ name: 'Normas', description: 'Catálogo, índices y texto legal.' }, { name: 'Historial', description: 'Cambios publicados, no cambios pendientes del scraper.' }],
  paths: {
    '/normas.json': operation('listarNormas', 'Todas las normas', 'Catálogo completo con conteos y enlaces. Sin texto de artículos.', 'Catalogo'),
    '/{norma}.json': operation('indiceNorma', 'Artículos de una norma', 'Metadatos e índice completo. Los ids de este índice sirven para consultar el texto.', 'IndiceNorma', [normaParameter]),
    '/{norma}/{articulo}.json': operation('leerArticulo', 'Texto de un artículo', 'Registro completo con enlaces anterior y siguiente (null en los extremos). Los artículos eliminados conservan HTML pero no este endpoint.', 'Articulo', [normaParameter, articleParameter]),
    '/historial.json': operation('historialGlobal', 'Cambios recientes', 'Totales por norma y hasta 100 cambios recientes, sin textos antes/después.', 'HistorialGlobal'),
    '/historial/{norma}.json': operation('historialNorma', 'Historial de una norma', 'Todos los cambios publicados, más nuevos primero, con textos antes/después. Una norma sin cambios devuelve total 0 y entradas vacías.', 'HistorialNorma', [normaParameter]),
  },
  components: { schemas: {
    Norma: object({ slug: str, nombre: str, corto: str, tipo: { type: 'string', enum: ['Constitución','Código','Ley','Decreto-ley','Decreto'] }, descripcion: str, fuente: str, articulos: { type: 'integer', minimum: 0 }, actualizado: maybeDate, json: uri, jsonl: uri, html: uri }),
    Catalogo: { ...object({ ...envelope, fuente_oficial: str, generado: date, normas: array(ref('Norma')) }), example: { version: API_VERSION, documentacion: abs('api/'), fuente_oficial: 'IMPO, Centro de Información Oficial (https://www.impo.com.uy)', generado: '2026-09-30T00:00:00Z', normas: NORMAS.slice(0,1).map(normaSummary) } },
    EnlaceArticulo: object(linkProperties),
    ArticuloIndice: object({ ...linkProperties, articulo: articleProperties.articulo, titulo: nullable, rubro: nullable, ...location, url_fuente: uri }),
    IndiceNorma: object({ ...envelope, norma: ref('Norma'), articulos: array(ref('ArticuloIndice')) }),
    RegistroArticulo: object(articleProperties, ['articulo','documento','texto','url_fuente']),
    Articulo: object({ ...envelope, norma: str, id: str, rubro: nullable, ...articleProperties,
      enlaces: object({ json: uri, html: uri, norma: uri, anterior: { ...object(linkProperties), nullable: true }, siguiente: { ...object(linkProperties), nullable: true } }),
    }, ['version','documentacion','norma','id','rubro','articulo','documento','texto','url_fuente','enlaces']),
    ResumenHistorial: object({ norma: str, desde: maybeDate, total: { type: 'integer', minimum: 0 }, ultimo: maybeDate, json: uri }),
    CambioReciente: object({ norma: str, ...changeProperties }),
    Cambio: object({ ...changeProperties, main_sha: nullable, antes: { ...object(articleProperties, []), nullable: true }, despues: { ...object(articleProperties, []), nullable: true } }),
    HistorialGlobal: object({ ...envelope, normas: array(ref('ResumenHistorial')), recientes: array(ref('CambioReciente')) }),
    HistorialNorma: object({ ...envelope, norma: str, desde: maybeDate, total: { type: 'integer', minimum: 0 }, entradas: array(ref('Cambio')) }),
  } },
};
