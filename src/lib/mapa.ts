// Mapa de citas: qué normas del sitio citan a cuáles, a partir de las referencias cruzadas.
// La disposición se calcula una sola vez en el build (fuerzas simples, sin azar) y sale como SVG estático.
import { NORMAS, getArticles, idOf, type Norma } from '../data/normas';
import { citadoPor } from './citas';

export type Nodo = { n: Norma; x: number; y: number; r: number; citada: number; citan: number; cita: number };
export type Enlace = { a: string; b: string; w: number };

export const LADO = 1000;

let cache: { nodos: Nodo[]; enlaces: Enlace[]; aisladas: Norma[] } | null = null;

export function mapa() {
  if (cache) return cache;
  // desde>hacia → cantidad de artículos citados
  const dir = new Map<string, number>();
  for (const n of NORMAS) for (const a of getArticles(n.slug)) for (const c of citadoPor(n.slug, idOf(a))) {
    if (c.slug === n.slug) continue;
    const k = `${c.slug}>${n.slug}`; dir.set(k, (dir.get(k) ?? 0) + 1);
  }
  const citada = new Map<string, number>(), citan = new Map<string, number>(), cita = new Map<string, number>();
  const par = new Map<string, number>();
  for (const [k, v] of dir) {
    const [a, b] = k.split('>');
    citada.set(b, (citada.get(b) ?? 0) + v); citan.set(b, (citan.get(b) ?? 0) + 1); cita.set(a, (cita.get(a) ?? 0) + 1);
    const p = a < b ? `${a}|${b}` : `${b}|${a}`; par.set(p, (par.get(p) ?? 0) + v);
  }
  // Solo el grupo conectado principal: las normas sueltas (o pares que solo se citan entre sí) van aparte.
  const vecinos = new Map<string, string[]>();
  for (const k of par.keys()) { const [a, b] = k.split('|'); (vecinos.get(a) ?? vecinos.set(a, []).get(a)!).push(b); (vecinos.get(b) ?? vecinos.set(b, []).get(b)!).push(a); }
  const grupo = new Set<string>(['codigo-civil']);
  for (const q = ['codigo-civil']; q.length;) for (const v of vecinos.get(q.pop()!) ?? []) if (!grupo.has(v)) { grupo.add(v); q.push(v); }
  const conectadas = NORMAS.filter(n => grupo.has(n.slug));
  const aisladas = NORMAS.filter(n => !grupo.has(n.slug));
  const enlaces: Enlace[] = [...par].map(([k, w]) => { const [a, b] = k.split('|'); return { a, b, w }; }).filter(e => grupo.has(e.a));

  const idx = new Map(conectadas.map((n, i) => [n.slug, i]));
  const N = conectadas.length, C = LADO / 2;
  // Posición inicial: espiral de Vogel ordenada por cuántas veces se la cita (las más citadas al centro).
  const orden = [...conectadas].sort((x, y) => (citada.get(y.slug) ?? 0) - (citada.get(x.slug) ?? 0));
  const px = new Float64Array(N), py = new Float64Array(N);
  orden.forEach((n, k) => { const i = idx.get(n.slug)!; const r = 30 * Math.sqrt(k + 0.5), t = k * 2.39996; px[i] = C + r * Math.cos(t); py[i] = C + r * Math.sin(t); });
  const radio = (s: string) => 4 + 1.6 * Math.sqrt(citada.get(s) ?? 0);
  const R = conectadas.map(n => radio(n.slug));
  const E = enlaces.map(e => [idx.get(e.a)!, idx.get(e.b)!, 1 + Math.log(e.w)] as const);
  const centro = idx.get('codigo-civil');
  const k = Math.sqrt((LADO * LADO * 0.5) / N);
  for (let it = 0, temp = 60; it < 400; it++, temp *= 0.99) {
    const dx = new Float64Array(N), dy = new Float64Array(N);
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let ex = px[i] - px[j], ey = py[i] - py[j]; let d = Math.hypot(ex, ey) || 0.01;
      const f = (k * k) / d + Math.max(0, R[i] + R[j] + 4 - d) * 3;
      ex /= d; ey /= d; dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f;
    }
    for (const [i, j, w] of E) {
      let ex = px[i] - px[j], ey = py[i] - py[j]; const d = Math.hypot(ex, ey) || 0.01;
      const f = (d * d) / k * w * 0.12;
      ex /= d; ey /= d; dx[i] -= ex * f; dy[i] -= ey * f; dx[j] += ex * f; dy[j] += ey * f;
    }
    for (let i = 0; i < N; i++) {
      dx[i] += (C - px[i]) * 0.06; dy[i] += (C - py[i]) * 0.06; // gravedad suave
      const d = Math.hypot(dx[i], dy[i]) || 1, m = Math.min(d, temp);
      px[i] += dx[i] / d * m; py[i] += dy[i] / d * m;
    }
    if (centro !== undefined) { px[centro] = C; py[centro] = C; }
  }
  // Compactar: acercar al centro las que quedaron lejos (conservando el ángulo) y llevar al cuadro final.
  const cx = centro !== undefined ? px[centro] : C, cy = centro !== undefined ? py[centro] : C;
  const dist = Array.from({ length: N }, (_, i) => Math.hypot(px[i] - cx, py[i] - cy));
  const dmax = Math.max(...dist.map(d => d ** 0.5)) || 1, esc = (C - 45) / dmax;
  for (let i = 0; i < N; i++) {
    const t = Math.atan2(py[i] - cy, px[i] - cx), d = dist[i] ** 0.5 * esc;
    px[i] = C + d * Math.cos(t); py[i] = C + d * Math.sin(t);
  }
  // Repaso final, ya con el tamaño real de los círculos: que ninguno pise a otro ni se salga.
  for (let it = 0; it < 300; it++) {
    let movio = false;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const ex = px[i] - px[j], ey = py[i] - py[j], d = Math.hypot(ex, ey) || 0.01, min = R[i] + R[j] + 3;
      if (d >= min) continue;
      movio = true; const m = (min - d) / 2, ux = ex / d, uy = ey / d;
      const fi = i === centro ? 0 : j === centro ? 2 : 1, fj = 2 - fi;
      px[i] += ux * m * fi; py[i] += uy * m * fi; px[j] -= ux * m * fj; py[j] -= uy * m * fj;
    }
    for (let i = 0; i < N; i++) { px[i] = Math.min(LADO - R[i] - 4, Math.max(R[i] + 4, px[i])); py[i] = Math.min(LADO - R[i] - 4, Math.max(R[i] + 4, py[i])); }
    if (!movio) break;
  }
  // Centrar y estirar para llenar el cuadro (solo posiciones: agrandar separa, no superpone).
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, px[i] - R[i]); x1 = Math.max(x1, px[i] + R[i]); y0 = Math.min(y0, py[i] - R[i]); y1 = Math.max(y1, py[i] + R[i]); }
  const f = Math.max(1, (LADO - 40) / Math.max(x1 - x0, y1 - y0)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (let i = 0; i < N; i++) { px[i] = C + (px[i] - mx) * f; py[i] = C + (py[i] - my) * f; }
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const nodos: Nodo[] = conectadas.map((n, i) => ({
    n, r: r1(R[i]), x: r1(px[i]), y: r1(py[i]),
    citada: citada.get(n.slug) ?? 0, citan: citan.get(n.slug) ?? 0, cita: cita.get(n.slug) ?? 0,
  }));
  cache = { nodos, enlaces, aisladas };
  return cache;
}
