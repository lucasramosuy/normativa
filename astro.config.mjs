import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';

// Fechas de último cambio publicado (rama api, historial/) para el lastmod del sitemap.
// Sin historial local (clon fresco sin `pnpm run data`) el sitemap sale sin lastmod.
function lastmodMap() {
  const map = new Map();
  try {
    const dir = path.resolve('historial');
    if (!fs.existsSync(dir)) return map;
    let global = null;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const slug = f.slice(0, -5);
      const h = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      let normaMax = h.desde ?? null;
      const porArticulo = new Map();
      for (const e of h.entradas ?? []) {
        if (!e.publicado) continue;
        if (!normaMax || e.publicado > normaMax) normaMax = e.publicado;
        const k = String(e.articulo).toLowerCase();
        if (!porArticulo.get(k) || e.publicado > porArticulo.get(k)) porArticulo.set(k, e.publicado);
        if (!global || e.publicado > global) global = e.publicado;
      }
      if (normaMax) {
        map.set(`/normativa/normas/${slug}`, normaMax.slice(0, 10));
        for (const [id, pub] of porArticulo) map.set(`/normativa/normas/${slug}/articulo/${id}`, pub.slice(0, 10));
        // Artículos sin cambios: fecha de incorporación de la norma.
        if (h.desde) {
          try {
            const dataFile = path.resolve(`data/${slug}.jsonl`);
            for (const line of fs.readFileSync(dataFile, 'utf8').trim().split(/\r?\n/)) {
              if (!line) continue;
              const k = String(JSON.parse(line).articulo).toLowerCase();
              if (!map.has(`/normativa/normas/${slug}/articulo/${k}`)) map.set(`/normativa/normas/${slug}/articulo/${k}`, h.desde.slice(0, 10));
            }
          } catch { /* sin data local */ }
        }
      }
    }
    if (global) map.set('/normativa/cambios', global.slice(0, 10));
  } catch { /* sin datos: sitemap sin lastmod */ }
  return map;
}
const LASTMOD = lastmodMap();
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  site: process.env.SITE_URL || 'https://lucasramos.uy',
  base: '/normativa/',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    sitemap({
      serialize(item) {
        const p = new URL(item.url).pathname.replace(/\/+$/, '');
        const lm = LASTMOD.get(p);
        if (lm) item.lastmod = lm; else delete item.lastmod;
        return item;
      },
    }),
    sentry({
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      sourceMapsUploadOptions: { org: 'lucass-space', project: 'normativa-uy', authToken: process.env.SENTRY_AUTH_TOKEN }
    })
  ],
  vite: { plugins: [tailwindcss()] }
});
