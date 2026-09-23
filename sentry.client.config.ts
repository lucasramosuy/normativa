import * as Sentry from '@sentry/astro';
const dsn = import.meta.env.PUBLIC_SENTRY_DSN || 'https://4a775a0337ef97459bc4f8cd28c6ba97@o4510988275482624.ingest.us.sentry.io/4512132646371328';
Sentry.init({ dsn, tracesSampleRate: 0.1, sendDefaultPii: false });
