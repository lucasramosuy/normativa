// Router for lucasramos.uy: /<proyecto>/* -> upstream. Everything else passes through to the origin (Netlify).
const ROUTES = {
  '/normativa': 'https://lucasramosuy.github.io/normativa',
};

// First-party ingest for Normativa, so adblockers don't drop errors and analytics.
// Sentry tunnel: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
// PostHog reverse proxy: https://posthog.com/docs/advanced/proxy/cloudflare
const INGEST = '/normativa/_i';
const SENTRY_HOST = 'o4510988275482624.ingest.us.sentry.io';
const SENTRY_PROJECTS = ['4512132646371328'];
const POSTHOG_API = 'us.i.posthog.com';
const POSTHOG_ASSETS = 'us-assets.i.posthog.com';

async function sentryTunnel(request) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await request.arrayBuffer();
  const firstLine = new TextDecoder().decode(body.slice(0, 4096)).split('\n')[0];
  let dsn;
  try { dsn = new URL(JSON.parse(firstLine).dsn); } catch { return new Response('Bad envelope', { status: 400 }); }
  const project = dsn.pathname.replace(/^\//, '');
  if (dsn.hostname !== SENTRY_HOST || !SENTRY_PROJECTS.includes(project)) return new Response('Unknown DSN', { status: 400 });
  return fetch(`https://${SENTRY_HOST}/api/${project}/envelope/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
    body,
  });
}

async function posthogProxy(request, path, ctx) {
  const url = new URL(request.url);
  if (path.startsWith('/static/') || path.startsWith('/array/')) {
    let res = await caches.default.match(request);
    if (!res) {
      res = await fetch(`https://${POSTHOG_ASSETS}${path}${url.search}`);
      ctx.waitUntil(caches.default.put(request, res.clone()));
    }
    return res;
  }
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('authorization');
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  return fetch(`https://${POSTHOG_API}${path}${url.search}`, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : null,
    redirect: request.redirect,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === `${INGEST}/s`) return sentryTunnel(request);
    if (url.pathname.startsWith(`${INGEST}/p/`)) return posthogProxy(request, url.pathname.slice(`${INGEST}/p`.length), ctx);

    for (const [prefix, upstream] of Object.entries(ROUTES)) {
      if (url.pathname === prefix) {
        return Response.redirect(`${url.origin}${prefix}/${url.search}`, 301);
      }
      if (url.pathname.startsWith(prefix + '/')) {
        const target = new URL(upstream + url.pathname.slice(prefix.length) + url.search);
        const upstreamReq = new Request(target, request);
        upstreamReq.headers.delete('cookie');
        const res = await fetch(upstreamReq, { redirect: 'manual' });
        const out = new Response(res.body, res);
        const loc = out.headers.get('location');
        if (loc) {
          const up = new URL(upstream);
          const l = new URL(loc, target);
          if (l.host === up.host && l.pathname.startsWith(up.pathname)) {
            out.headers.set('location', url.origin + prefix + l.pathname.slice(up.pathname.length) + l.search);
          }
        }
        return out;
      }
    }
    return fetch(request);
  },
};
