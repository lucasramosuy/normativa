import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  site: process.env.SITE_URL || 'https://lucasramos.uy',
  base: '/normativa/',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    sitemap(),
    sentry({
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      sourceMapsUploadOptions: { org: 'lucass-space', project: 'normativa-uy', authToken: process.env.SENTRY_AUTH_TOKEN }
    })
  ],
  vite: { plugins: [tailwindcss()] }
});
