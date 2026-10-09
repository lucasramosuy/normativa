import test from 'node:test';import assert from 'node:assert/strict';
// El router del Worker es un ES module; importar como data URL evita cambiar el package.json de la web.
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./proxy.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const original=globalThis.fetch;let seen=[];
function mock(response=new Response('ok')){seen=[];globalThis.fetch=async(request)=>{seen.push(new Request(request));return response.clone();};}
const run=path=>worker.fetch(new Request('https://lucasramos.uy'+path,{headers:{cookie:'private=1'}}),{},{});
test('sin barra redirige al path canónico y conserva query',async()=>{mock();const r=await run('/intemperie?cielo=rivera');assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://lucasramos.uy/intemperie/?cielo=rivera');assert.equal(seen.length,0);});
test('home, módulos y snapshot mantienen prefijo GitHub y no mandan cookies',async()=>{for(const p of ['/intemperie/','/intemperie/app.mjs','/intemperie/weather.json?v=1','/intemperie/style.css']){mock();await run(p);assert.equal(seen[0].url,'https://lucasramosuy.github.io'+p);assert.equal(seen[0].headers.get('cookie'),null);}});
test('404 del upstream se conserva',async()=>{mock(new Response('404',{status:404}));assert.equal((await run('/intemperie/no-existe')).status,404);});
test('redirecciones propias quedan en el dominio',async()=>{mock(new Response(null,{status:301,headers:{location:'https://lucasramosuy.github.io/intemperie/otra/'}}));assert.equal((await run('/intemperie/archivo')).headers.get('location'),'https://lucasramos.uy/intemperie/otra/');});
test('no roba rutas ajenas ni prefijos similares',async()=>{for(const p of ['/','/intemperie-otro/','/normativa/','/profe/','/rebote/']){mock();await run(p);const expected=p==='/normativa/'?'https://lucasramosuy.github.io/normativa/':p==='/profe/'?'https://lucasramosuy.github.io/profe/':p==='/rebote/'?'https://rebote-a9c.pages.dev/':'https://www-7r1.pages.dev'+p;assert.equal(seen[0].url,expected);}});
test.after(()=>{globalThis.fetch=original;});
