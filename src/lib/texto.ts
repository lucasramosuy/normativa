/** Pure text helpers (no Node APIs): shared by the build and by pages that render articles in the browser. */
export type Block = { type: 'p'; text: string } | { type: 'list'; items: { marker: string; text: string }[] };
const MARKER = /^((?:[A-Za-z]|[0-9]{1,3}[°º]?|[IVXLC]{1,6})\))\s*([A-Za-zÁÉÍÓÚÑáéíóúñ¿\"“(].*)$/;

/** Splits the "(Legítima defensa).-" marginal title off the start of the text. */
export function splitTitle(texto: string): { rubro: string | null; body: string } {
  // The title can wrap onto several lines in IMPO, e.g. "(Incitación al odio ... hacia determinadas\npersonas)".
  const m = texto.match(/^\s*\(([^()]{2,200})\)\s*\.?\s*-?\s*/);
  if (!m || /^derogad/i.test(m[1])) return { rubro: null, body: texto.trim() };
  return { rubro: m[1].replace(/\s+/g, ' ').trim(), body: texto.slice(m[0].length).trim() };
}

/** Reflows IMPO hard-wrapped lines into paragraphs and enumerated lists. */
export function toBlocks(body: string): Block[] {
  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blocks: Block[] = [];
  let cur: { kind: 'p' | 'item'; text: string; marker?: string } | null = null;
  const flush = () => {
    if (!cur) return;
    if (cur.kind === 'p') blocks.push({ type: 'p', text: cur.text });
    else {
      const last = blocks[blocks.length - 1];
      const item = { marker: cur.marker!, text: cur.text };
      if (last && last.type === 'list') last.items.push(item); else blocks.push({ type: 'list', items: [item] });
    }
    cur = null;
  };
  for (const line of lines) {
    const m = line.match(MARKER);
    const ends = cur ? (/[.:]["”)]?$/.test(cur.text) && !/\b(?:arts?|inc|incs|num|lit|ley|Nº|N°|Dr|Sr|Sra|etc)\.$/i.test(cur.text)) || (cur.kind === 'item' && /;$/.test(cur.text)) : true;
    if (m && (ends || !cur || /[;,]$/.test(cur.text))) { flush(); cur = { kind: 'item', marker: m[1], text: m[2] }; continue; }
    if (cur && !ends) { cur.text += ' ' + line; continue; }
    flush(); cur = { kind: 'p', text: line };
  }
  flush();
  return blocks;
}
