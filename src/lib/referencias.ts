/** Formato jurídico híbrido APA/Bluebook, adaptado de la guía aportada por Lucas.
 * No deducir una fecha de promulgación de fecha_publicacion o fecha_scraping. */
import type {Article, Norma} from '../data/normas';
export type RefLegal={texto:string;enTexto:string;avisos:string[];fuente:string};
const shortYear=(date?:string)=>(date||" ").match(/\b\d{4}\b/)?.[0]||null;
export function fechaLegal(value?:string):string|null {
  if(!value)return null;
  const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)return null;
  const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
  const dt=new Date(Date.UTC(year,month-1,day));
  if(dt.getUTCDate()!==day||dt.getUTCMonth()!==month-1)return null;
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
  return `${day} de ${meses[month-1]} de ${year}`;
}
export function referenciaLegal(n:Norma,a:Article):RefLegal {
  const art=String(a.articulo_id||a.articulo);
  const fecha=fechaLegal(a.fecha_promulgacion);
  const ano=shortYear(a.fecha_promulgacion)||n.anio?.toString()||'s. f.';
  const avisos:string[]=[];
  if(!fecha)avisos.push('Fecha de promulgación no verificada en estos datos: revisá IMPO antes de entregar la cita.');
  const fuente=/^https:\/\/www\.impo\.com\.uy\//.test(a.url_fuente||'')?a.url_fuente:'';
  if(!fuente)avisos.push('Falta el enlace oficial de este artículo.');
  let nombre='';
  if(n.tipo==='Constitución') {
    nombre=`${n.nombre} [Const.]. Art. ${art}. ${fecha||'Fecha de promulgación por verificar'} (Uruguay).`;
  } else if(n.tipo==='Código') {
    // La ley de origen no consta como campo estructurado para todos los códigos.
    avisos.push('Ley de origen del código por verificar en IMPO; no se deduce del número de URL.');
    nombre=`${n.nombre}. Art. ${art}. ${fecha||'Fecha de promulgación por verificar'} (Uruguay).`;
  } else {
    const numero=n.numero?`${n.tipo} ${n.numero} de ${n.anio||ano}`:`${n.tipo} (número por verificar)`;
    if(!n.numero)avisos.push('Número de norma no verificado.');
    const asunto=n.titulo_impo&&n.titulo_impo.trim()?`. ${n.titulo_impo.trim().replace(/\.$/,'')}`:'';
    if(!asunto)avisos.push('Asunto oficial no disponible en estos datos.');
    nombre=`${numero}. Art. ${art}${asunto}. ${fecha||'Fecha de promulgación por verificar'} (Uruguay).`;
    if(!a.fecha_publicacion)avisos.push('Publicación oficial no verificada: no se agrega un número de Diario Oficial.');
  }
  const cita=n.tipo==='Constitución'?`${n.corto}, ${ano}, art. ${art}`:n.tipo==='Código'?`${n.nombre}, ${ano}, art. ${art}`:`${n.tipo} ${n.numero||''}, ${ano}, art. ${art}`;
  return {texto:`${nombre}${fuente?' '+fuente:''}`,enTexto:`(${cita})`,avisos,fuente};
}
