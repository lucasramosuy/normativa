import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://lucasramosuy.github.io',
  base: '/normativa-uy/',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    sitemap(),
    ...(process.env.PUBLIC_SENTRY_DSN ? [sentry({ sourceMapsUploadOptions: process.env.SENTRY_AUTH_TOKEN ? { org: 'lucass-space', project: 'normativa-uy', authToken: process.env.SENTRY_AUTH_TOKEN } : undefined })] : [])
  ],
  vite: { plugins: [tailwindcss()], build: { sourcemap: true } }
});
