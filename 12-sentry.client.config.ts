import * as Sentry from '@sentry/astro';
const dsn=import.meta.env.PUBLIC_SENTRY_DSN;
if(dsn) Sentry.init({dsn,tracesSampleRate:0.1,sendDefaultPii:false});
