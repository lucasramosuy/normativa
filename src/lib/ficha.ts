/** "Armar ficha": the selection lives only in this browser (localStorage). Items are "norma/articulo" keys. */
export type Ficha = { titulo: string; items: string[] };
const KEY = 'normativa-ficha';
const EVENT = 'ficha-change';

export function getFicha(): Ficha {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (f && Array.isArray(f.items)) return { titulo: String(f.titulo || ''), items: f.items.filter((x: unknown) => typeof x === 'string') };
  } catch {}
  return { titulo: '', items: [] };
}

export function saveFicha(f: Ficha) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export const inFicha = (key: string) => getFicha().items.includes(key);

export function toggleFicha(key: string) {
  const f = getFicha();
  f.items = f.items.includes(key) ? f.items.filter(k => k !== key) : [...f.items, key];
  saveFicha(f);
}

/** Keeps every [data-ficha] button and the header counter in sync, including across tabs. */
export function onFichaChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', e => { if (e.key === KEY) fn(); });
}

function paintButton(b: HTMLElement) {
  const on = inFicha(b.dataset.ficha!);
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? '✓ En la ficha' : '+ Ficha';
  b.title = on ? 'Quitar de la ficha' : 'Agregar a la ficha';
}

/** Wires +Ficha buttons inside root (call again after rendering new ones). */
export function wireFichaButtons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-ficha]').forEach(b => {
    paintButton(b);
    if (b.dataset.fichaWired) return;
    b.dataset.fichaWired = '1';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleFicha(b.dataset.ficha!); });
  });
}

onFichaChange(() => document.querySelectorAll<HTMLElement>('[data-ficha]').forEach(paintButton));
