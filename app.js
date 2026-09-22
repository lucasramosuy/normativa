const els = Object.fromEntries(['search','clear','status','error','retry','content','results','count','more','detail','detail-meta','detail-title','detail-context','detail-text','detail-notes','source','close-detail','prev','next'].map(id => [id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()), document.getElementById(id)]));
let articles=[], filtered=[], shown=24, selected=null;
const fold=s=>(s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>(s??'').toString().replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const articleNo=a=>Number(a.articulo);
function context(a){return [a.seccion,a.capitulo,a.titulo].filter(Boolean).join(' · ')}
function searchable(a){return fold([a.articulo,a.texto,a.seccion,a.capitulo,a.titulo,a.notas_oficiales].join(' '))}
function query(){return fold(els.search.value.trim()).replace(/^art(i|í)culo\s+/,'')}
function render(){
 const q=query(); filtered=q?articles.filter(a=>searchable(a).includes(q)):articles;
 els.count.textContent=`${filtered.length} ${filtered.length===1?'artículo':'artículos'}`;
 els.status.textContent=q?`${filtered.length} resultado${filtered.length===1?'':'s'} para “${els.search.value.trim()}”`:`Mostrando los ${articles.length} artículos de la Constitución`;
 els.clear.disabled=!els.search.value;
 const subset=filtered.slice(0,shown);
 els.results.innerHTML=subset.length?subset.map(a=>`<article class="rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-celeste hover:shadow-md"><button class="w-full text-left" data-article="${articleNo(a)}"><div class="flex items-start justify-between gap-4"><div><p class="text-sm font-bold text-celeste">Artículo ${articleNo(a)}</p><h3 class="mt-1 font-bold">${esc(context(a)||'Constitución de la República')}</h3></div><span aria-hidden="true" class="text-xl text-slate-400">›</span></div><p class="mt-3 line-clamp-3 leading-6 text-slate-600">${esc(a.texto)}</p></button></article>`).join(''):`<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div class="text-3xl">⌕</div><h3 class="mt-3 text-lg font-bold">No encontramos artículos</h3><p class="mt-1 text-sm text-slate-500">Probá con menos palabras, otra forma de escribir o un número de artículo.</p></div>`;
 els.more.classList.toggle('hidden',shown>=filtered.length); bindResults();
}
function bindResults(){document.querySelectorAll('[data-article]').forEach(b=>b.addEventListener('click',()=>openArticle(Number(b.dataset.article),true)))}
function openArticle(n,writeHash=false){
 const a=articles.find(x=>articleNo(x)===n); if(!a)return; selected=n;
 els.detailMeta.textContent=a.documento||'Constitución de la República'; els.detailTitle.textContent=`Artículo ${n}`; els.detailContext.textContent=context(a);
 els.detailText.textContent=a.texto||''; const notes=a.notas_oficiales;
 els.detailNotes.classList.toggle('hidden',!notes); els.detailNotes.textContent=notes?`Notas oficiales: ${typeof notes==='string'?notes:JSON.stringify(notes)}`:'';
 els.source.href=a.url_fuente; els.prev.disabled=n<=Math.min(...articles.map(articleNo)); els.next.disabled=n>=Math.max(...articles.map(articleNo)); els.detail.classList.remove('hidden');
 if(writeHash) history.pushState(null,'',`#articulo-${n}`); if(innerWidth<1024) els.detail.scrollIntoView({behavior:'smooth',block:'start'});
}
async function load(){
 els.error.classList.add('hidden'); els.content.classList.remove('hidden'); els.status.textContent='Cargando artículos…';
 try{const r=await fetch('./data/constitucion.jsonl',{cache:'no-cache'});if(!r.ok)throw new Error(r.status);const text=await r.text();articles=text.trim().split(/\r?\n/).map((line,i)=>{try{return JSON.parse(line)}catch{throw new Error(`Línea ${i+1}`)}}).sort((a,b)=>articleNo(a)-articleNo(b)); if(!articles.length)throw new Error('vacío');shown=24;render();const m=location.hash.match(/^#articulo-(\d+)$/);if(m)openArticle(Number(m[1]));}
 catch(e){console.error(e);els.content.classList.add('hidden');els.error.classList.remove('hidden');els.status.textContent='Error al cargar';}
}
els.search.addEventListener('input',()=>{shown=24;render()});els.clear.addEventListener('click',()=>{els.search.value='';shown=24;render();els.search.focus()});els.more.addEventListener('click',()=>{shown+=24;render()});els.retry.addEventListener('click',load);
els.closeDetail.addEventListener('click',()=>{els.detail.classList.add('hidden');selected=null;history.pushState(null,'',location.pathname+location.search)});els.prev.addEventListener('click',()=>openArticle(selected-1,true));els.next.addEventListener('click',()=>openArticle(selected+1,true));
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==els.search){e.preventDefault();els.search.focus()}if(e.key==='Escape'&&selected)els.closeDetail.click()});window.addEventListener('popstate',()=>{const m=location.hash.match(/^#articulo-(\d+)$/);m?openArticle(Number(m[1])):els.detail.classList.add('hidden')});load();
