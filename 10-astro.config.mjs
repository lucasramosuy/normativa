import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://lucasramosuy.github.io',
  base: '/normativa-uy',
  output: 'static',
  integrations: [
    sitemap(),
    ...(process.env.PUBLIC_SENTRY_DSN ? [sentry({ sourceMapsUploadOptions: undefined })] : [])
  ],
  vite: { plugins: [tailwindcss()] }
});
