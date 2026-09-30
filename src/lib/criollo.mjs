import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const campos = ['texto','notas_oficiales','estado_actual'];
export const hashFuente = a => createHash('sha256').update(JSON.stringify(Object.fromEntries(campos.map(k=>[k,a[k]||''])))).digest('hex');
export function evaluarExplicacion(registro, articulo, resolver, vistaBorrador=false) {
  if (!registro) return {estado:'ausente',registro:null};
  if (!articulo?.texto || /^\s*\(?derogad/i.test(articulo.texto)) return {estado:'no-disponible',registro:null};
  if (registro.hash_fuente!==hashFuente(articulo) || (registro.dependencias||[]).some(d=>{const a=resolver(d.norma,d.articulo);return !a||hashFuente(a)!==d.hash})) return {estado:'desactualizado',registro:null};
  if (registro.estado==='aprobado' && registro.revision?.responsable?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(registro.revision?.fecha||'')) return {estado:'aprobado',registro};
  return vistaBorrador ? {estado:'borrador',registro} : {estado:'pendiente',registro:null};
}
export function cargarExplicacion(slug,id,articulo,resolver,{retirado=false,vistaBorrador=false}={}) {
  if (retirado) return {estado:'no-disponible',registro:null};
  const file=path.resolve('explicaciones',`${slug}.jsonl`);
  if (!fs.existsSync(file)) return {estado:'ausente',registro:null};
  const registros=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
  return evaluarExplicacion(registros.find(r=>r.articulo===id),articulo,resolver,vistaBorrador);
}
