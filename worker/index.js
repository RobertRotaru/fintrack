// Cloudflare Worker: serves the web app (web/dist) and forwards /api/* to the API on Heroku, so the web app keeps
// calling /api on its own domain (no CORS, nothing to configure in the app). Set API_ORIGIN (your Heroku Web URL)
// under the Worker's Settings → Variables and Secrets. Config: wrangler.jsonc. README → Deploying.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Only /api/* reaches this code (run_worker_first); everything else is served from web/dist.
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.API_ORIGIN) return new Response('API_ORIGIN is not set', { status: 500 });
    const forwarded = new Request(new URL(url.pathname + url.search, env.API_ORIGIN), request);
    // The visitor's address, for the API's login throttling (otherwise it would see Cloudflare's).
    const ip = request.headers.get('cf-connecting-ip');
    if (ip) forwarded.headers.set('x-forwarded-for', ip);
    forwarded.headers.set('x-forwarded-proto', 'https');
    return fetch(forwarded, { redirect: 'manual' });
  },
};
