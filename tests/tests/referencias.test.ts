import assert from 'node:assert/strict';
import { fechaLegal, referenciaLegal } from '../src/lib/referencias.ts';
import type { Article, Norma } from '../src/data/normas.ts';
const n:Norma={slug:'constitucion',nombre:'Constitución',corto:'Constitución',tipo:'Constitución',descripcion:'',fuente:''};
const a:Article={articulo:7,documento:'Constitución',texto:'',url_fuente:'https://www.impo.com.uy/bases/constitucion/1967-1967/7',fecha_publicacion:'02/02/1967'};
const pub=referenciaLegal(n,a);
assert.match(pub.texto,/Publicación: 2 de febrero de 1967/);
assert.doesNotMatch(pub.texto,/por verificar/);
assert.match(pub.enTexto,/1967/);
assert.match(pub.avisos.join(' '),/no acredita una fecha de promulgación/);
const prom=referenciaLegal(n,{...a,fecha_promulgacion:'01/02/1967'});
assert.match(prom.texto,/1 de febrero de 1967/);
assert.doesNotMatch(prom.texto,/Publicación:/);
assert.equal(prom.avisos.length,0);
for (const fecha of [undefined,'31/02/1967','02/13/1967','not-a-date']) {
  assert.equal(fechaLegal(fecha),null);
  const ref=referenciaLegal(n,{...a,fecha_publicacion:fecha});
  assert.match(ref.texto,/Fecha legal por verificar/);
  assert.match(ref.avisos.join(' '),/Sin fecha de promulgación ni de publicación/);
}
assert.equal(fechaLegal('29/02/2024'),'29 de febrero de 2024');
assert.equal(fechaLegal('29/02/2023'),null);
for (const tipo of ['Código','Ley','Decreto-ley','Decreto'] as const) {
 const ref=referenciaLegal({...n,tipo,numero:'16.011',anio:1988,titulo_impo:'Acción de amparo'},a);
 assert.match(ref.texto,/Publicación: 2 de febrero de 1967/);
}
console.log('Citas: publicación, promulgación, fechas inválidas y cinco tipos de norma OK');
