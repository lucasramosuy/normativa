/** Sin dependencias nuevas: ejecutar tras pnpm build con node tests/openapi.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const spec = JSON.parse(fs.readFileSync('dist/api/openapi.json', 'utf8'));
assert.equal(spec.openapi, '3.0.3');
assert.equal(Object.keys(spec.paths).length, 5);
assert.equal(spec.servers[0].url, 'https://lucasramos.uy/normativa/api/v1');
const resolve = s => s.$ref ? spec.components.schemas[s.$ref.split('/').at(-1)] : s;
// Los tipos de este contrato: objetos, arrays, strings, integers, nullables y oneOf.
function validate(value, source, at = '$') {
  const s = resolve(source);
  if (value === null && s.nullable) return;
  if (s.oneOf) {
    const matches = s.oneOf.filter(schema => { try { validate(value, schema, at); return true; } catch { return false; } });
    assert.equal(matches.length, 1, `${at}: oneOf`); return;
  }
  if (s.enum) assert.ok(s.enum.includes(value), `${at}: enum`);
  if (s.type === 'object') {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), `${at}: objeto`);
    for (const field of s.required || []) assert.ok(field in value, `${at}.${field}: obligatorio`);
    for (const [field, v] of Object.entries(value)) if (s.properties?.[field]) validate(v, s.properties[field], `${at}.${field}`);
  } else if (s.type === 'array') {
    assert.ok(Array.isArray(value), `${at}: array`);
    value.forEach((v, i) => validate(v, s.items, `${at}[${i}]`));
  } else if (s.type === 'integer') {
    assert.ok(Number.isInteger(value), `${at}: integer`);
    if (s.minimum !== undefined) assert.ok(value >= s.minimum, `${at}: minimum`);
  } else if (s.type === 'string') {
    assert.equal(typeof value, 'string', `${at}: string`);
    if (s.format === 'uri') assert.ok(new URL(value), `${at}: URI`);
    if (s.format === 'date-time') assert.ok(!Number.isNaN(Date.parse(value)), `${at}: fecha ISO`);
  }
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const root = path.join('dist', 'api', 'v1');
let count = 0;
for (const file of walk(root)) {
  const rel = path.relative(root, file);
  const name = rel === 'normas.json' ? 'Catalogo' : rel === 'historial.json' ? 'HistorialGlobal' : rel.startsWith('historial/') ? 'HistorialNorma' : rel.includes('/') ? 'Articulo' : 'IndiceNorma';
  validate(JSON.parse(fs.readFileSync(file, 'utf8')), spec.components.schemas[name], rel); count++;
}
const envelope = { version: 1, documentacion: 'https://lucasramos.uy/normativa/api/' };
for (const tipo of ['agregado', 'modificado', 'eliminado']) {
  validate({ ...envelope, norma: 'constitucion', desde: null, total: 1, entradas: [{ articulo: '7', tipo, campos: ['texto'], publicado: '2026-09-30T00:00:00Z', detectado: '2026-09-29T00:00:00Z', pr: null, main_sha: null, antes: tipo === 'agregado' ? null : { texto: 'antes' }, despues: tipo === 'eliminado' ? null : { texto: 'después' }, html: 'https://lucasramos.uy/normativa/' }] }, spec.components.schemas.HistorialNorma);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'normas.json'), 'utf8'));
assert.deepEqual(spec.paths['/{norma}.json'].get.parameters[0].schema.enum, catalog.normas.map(n => n.slug));
for (const [route, op] of Object.entries(spec.paths)) {
  assert.deepEqual(Object.keys(op), ['get']);
  for (const name of route.matchAll(/\{([^}]+)\}/g)) assert.ok(op.get.parameters.some(p => p.name === name[1] && p.required));
  assert.ok(op.get.responses['404'].content['text/html']);
}
console.log(`OpenAPI: ${count} respuestas publicadas y 3 cambios sintéticos conformes; 5 GET, parámetros, slugs y errores verificados.`);
