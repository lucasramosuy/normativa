import * as Sentry from '@sentry/astro';
const dsn = import.meta.env.PUBLIC_SENTRY_DSN || 'https://35f54e60b62bcc68786e3bc4e0bdccd0@o4510988275482624.ingest.us.sentry.io/4512132638048256';
Sentry.init({ dsn, tracesSampleRate: 0.1, sendDefaultPii: false });
