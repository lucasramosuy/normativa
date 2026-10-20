// Genera public/og.png (1200x630) desde public/og.svg con las tipografías de marca.
// WhatsApp, X y otros no aceptan SVG como og:image; el PNG es el que se publica.
// Uso: pnpm run og
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = fs.readFileSync('public/og.svg', 'utf8')
  .replace(/Georgia/g, 'Source Serif 4')
  .replace(/Arial/g, 'Space Grotesk');

const resvg = new Resvg(svg, {
  background: '#f5f1e8',
  font: {
    fontFiles: ['src/lib/source-serif-700-pdf.ttf', 'src/lib/source-serif-400-pdf.ttf', 'src/lib/space-grotesk-400-pdf.ttf'],
    loadSystemFonts: false,
    defaultFontFamily: 'Source Serif 4',
  },
});

fs.writeFileSync('public/og.png', resvg.render().asPng());
console.log('public/og.png generado');
