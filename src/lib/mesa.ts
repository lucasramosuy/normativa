/** The reading rail is navigation within this site, not embedded copies or browser tabs. */
export type MesaItem={key:string;label:string};
const KEY='normativa-mesa-v1';
export function getMesa():MesaItem[]{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter((x:any)=>x&&typeof x.key==='string'&&/^[a-z0-9-]+\/[a-z0-9-]+$/.test(x.key)&&typeof x.label==='string').slice(0,30):[]}catch{return []}}
export function setMesa(items:MesaItem[]){try{localStorage.setItem(KEY,JSON.stringify(items));}catch{}}
export function addMesa(item:MesaItem){const arr=getMesa();if(!arr.some(x=>x.key===item.key)){arr.push(item);setMesa(arr)}return arr}
export type RefItem={key:string;texto:string;enTexto:string;avisos:string[];fuente:string;label:string};
const REF='normativa-referencias-v1';
export function getRefs():RefItem[]{try{const v=JSON.parse(localStorage.getItem(REF)||'[]');return Array.isArray(v)?v.filter((x:any)=>x&&typeof x.key==='string'&&typeof x.texto==='string').slice(0,500):[]}catch{return []}}
export function setRefs(v:RefItem[]){try{localStorage.setItem(REF,JSON.stringify(v))}catch{}}
export function addRef(item:RefItem){const arr=getRefs();const i=arr.findIndex(x=>x.key===item.key);if(i<0)arr.push(item);else arr[i]=item;setRefs(arr);return arr}
