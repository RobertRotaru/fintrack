// Cloudflare Pages Function: forwards /api/* to the API on Heroku, so the web app keeps calling /api on its own
// domain (no CORS, nothing to configure in the app). API_ORIGIN is set in the Pages project. README → Deploying.
export async function onRequest({ request, env }) {
  if (!env.API_ORIGIN) return new Response('API_ORIGIN is not set', { status: 500 });
  const url = new URL(request.url);
  const forwarded = new Request(new URL(url.pathname + url.search, env.API_ORIGIN), request);
  // The visitor's address, for the API's login throttling (otherwise it would see Cloudflare's).
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) forwarded.headers.set('x-forwarded-for', ip);
  forwarded.headers.set('x-forwarded-proto', 'https');
  return fetch(forwarded, { redirect: 'manual' });
}
