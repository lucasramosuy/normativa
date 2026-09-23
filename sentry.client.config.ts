import * as Sentry from '@sentry/astro';
const dsn = import.meta.env.PUBLIC_SENTRY_DSN || 'https://4a775a0337ef97459bc4f8cd28c6ba97@o4510988275482624.ingest.us.sentry.io/4512132646371328';
// Events go through the lucasramos.uy Worker (/normativa/_i/s) so adblockers don't drop them.
Sentry.init({ dsn, tunnel: `${import.meta.env.BASE_URL}_i/s`, tracesSampleRate: 0.1, sendDefaultPii: false });
