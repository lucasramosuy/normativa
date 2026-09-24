/** "Armar ficha": the selection lives only in this browser (localStorage). Items are "norma/articulo" keys.
 * textos holds the teacher's edited version of an article (sanitized HTML), keyed the same way; only /ficha/ reads it. */
export type Ficha = { titulo: string; items: string[]; textos: Record<string, string> };
const KEY = 'normativa-ficha';
const EVENT = 'ficha-change';

export function getFicha(): Ficha {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (f && Array.isArray(f.items)) {
      const textos = f.textos && typeof f.textos === 'object' ? Object.fromEntries(Object.entries(f.textos).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
      return { titulo: String(f.titulo || ''), items: f.items.filter((x: unknown) => typeof x === 'string'), textos };
    }
  } catch {}
  return { titulo: '', items: [], textos: {} };
}

/** quiet=true stores without repainting this tab (used while typing inside an article). */
export function saveFicha(f: Ficha, quiet = false) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
  if (!quiet) window.dispatchEvent(new Event(EVENT));
}

export const inFicha = (key: string) => getFicha().items.includes(key);

export function toggleFicha(key: string) {
  const f = getFicha();
  if (f.items.includes(key)) { f.items = f.items.filter(k => k !== key); delete f.textos[key]; } else f.items = [...f.items, key];
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
