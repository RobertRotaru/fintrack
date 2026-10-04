/**
 * End-to-end checks for page transitions and the loading, empty, error, offline,
 * 404 and failed-download states. Runs headless Chrome against the dev servers
 * (web on :5173, API on :4000) and fakes slow/failing/absent APIs by
 * intercepting requests. Screenshots go to OUT_DIR when set.
 *
 *   E2E_EMAIL / E2E_PASSWORD  an account with data (e.g. after "Load demo data")
 *   CHROME_PATH               Chrome/Chromium executable
 *   CHROME_ARGS               extra launch flags, space-separated (e.g. --no-sandbox in containers)
 */
import puppeteer from 'puppeteer-core';
const OUT = process.env.OUT_DIR;
const BASE = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:4000';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD to an account that has data.');
  process.exit(2);
}
const shot = (name) => (OUT ? page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 }) : null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const login = async (email, password) =>
  (await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: (process.env.CHROME_ARGS ?? '').split(' ').filter(Boolean) });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const token = await login(process.env.E2E_EMAIL, process.env.E2E_PASSWORD);
await page.goto(BASE);
await page.evaluate((t) => {
  localStorage.setItem('ft.token', t);
  localStorage.setItem('theme', 'dark');
}, token);

// Request interception lets each scenario fake a slow, failing or absent API.
let rule = null;
await page.setRequestInterception(true);
page.on('request', async (req) => {
  const r = rule?.(req.url());
  if (!r) return req.continue();
  if (r === 'abort') return req.abort('failed');
  if (r.delay) {
    await wait(r.delay);
    return req.continue();
  }
  return req.respond({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body ?? {}) });
});
const navClient = (path) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const ready = () => page.waitForSelector('main h1, [data-testid=not-found], [data-testid=error-state], [data-testid=crash-state]', { timeout: 15000 });
const h1 = () => page.evaluate(() => document.querySelector('main h1')?.textContent);

// ---- 1. Page transitions ---------------------------------
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await ready();
for (const p of ['/reports', '/insights', '/goals', '/accounts', '/projections', '/']) {
  await navClient(p);
  await ready();
  await wait(400);
}
const samples = [];
for (const p of ['/reports', '/insights', '/goals', '/accounts', '/projections', '/']) {
  samples.push(
    await page.evaluate(async (path) => {
      history.pushState({}, '', path);
      dispatchEvent(new PopStateEvent('popstate'));
      const t0 = performance.now();
      const frames = [];
      await new Promise((done) => {
        const tick = () => {
          const el = document.querySelector('[data-testid=page]');
          const cs = el && getComputedStyle(el);
          frames.push({ t: performance.now() - t0, op: cs ? Number(cs.opacity) : null, anim: cs?.animationName, dur: cs?.animationDuration });
          if (performance.now() - t0 < 450) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      return frames;
    }, p),
  );
}
const durs = [...new Set(samples.flat().map((f) => f.dur).filter(Boolean))];
const anim = samples.flat().find((f) => f.anim)?.anim;
const started = samples.every((s) => s.some((f) => f.op !== null && f.op < 1));
const settledAt = samples.map((s) => s.find((f) => f.op === 1 && f.t > 20)?.t ?? 999);
check('transition uses the page-in animation', anim === 'page-in', `animation=${anim}`);
check('transition duration is 150–300ms', durs.every((d) => { const ms = parseFloat(d) * (d.endsWith('ms') ? 1 : 1000); return ms >= 150 && ms <= 300; }), durs.join(','));
check('animation actually plays on every navigation', started);
check('content fully visible within 320ms', settledAt.every((t) => t <= 320), `settled at ${settledAt.map((t) => Math.round(t)).join(', ')}ms`);

await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await navClient('/reports');
await ready();
const reduced = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('[data-testid=page]'));
  return { name: cs.animationName, op: cs.opacity };
});
check('reduced motion disables page animation', reduced.name === 'none' && reduced.op === '1', JSON.stringify(reduced));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

// ---- 2. Loading skeleton -----------------------------------------------------
rule = (u) => (u.includes('/api/transactions') ? { delay: 1500 } : null);
await page.goto(BASE + '/transactions');
await page.waitForSelector('[data-testid=page-skeleton]', { timeout: 5000 }).catch(() => null);
await wait(450);
const sk = await page.evaluate(() => {
  const el = document.querySelector('[data-testid=page-skeleton]');
  return el && { busy: el.getAttribute('aria-busy'), rows: el.querySelectorAll('.skeleton').length, inLayout: !!document.querySelector('aside') };
});
await shot('state-loading');
check('slow data shows a page-shaped skeleton inside the layout', !!sk && sk.busy === 'true' && sk.rows > 5 && sk.inLayout, JSON.stringify(sk));
await page.waitForSelector('main h1', { timeout: 5000 });
check('skeleton is replaced by content when data arrives', (await page.$('[data-testid=page-skeleton]')) === null);

rule = null;
await navClient('/accounts');
await wait(30);
const flash = await page.evaluate(() => {
  const el = document.querySelector('[data-testid=page-skeleton]');
  return el ? Number(getComputedStyle(el).opacity) : 0;
});
check('fast loads do not flash a skeleton', flash === 0, `skeleton opacity at 30ms: ${flash}`);

// ---- 3. Server error + retry -------------------------------------------------
rule = (u) => (u.includes('/api/goals') ? { status: 500, body: { error: 'db down' } } : null);
await page.goto(BASE + '/goals');
await page.waitForSelector('[data-testid=error-state]', { timeout: 8000 });
const errText = await page.$eval('[data-testid=error-state]', (e) => e.innerText);
await shot('state-error');
const showsEmpty = await page.evaluate(() => document.body.innerText.includes('What are you saving for'));
check('server error shows an error screen, not the empty "no goals" screen', /went wrong on our side/i.test(errText) && !showsEmpty);
rule = null;
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /try again/i.test(b.innerText)).click());
const recovered = await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Goals', { timeout: 8000 }).then(() => true, () => false);
check('Try again recovers once the server is back', recovered);

// ---- 4. Offline at startup ---------------------------------------------------
rule = (u) => (u.includes('/api/') ? 'abort' : null);
await page.goto(BASE + '/');
await page.waitForFunction(() => document.body.innerText.includes('retrying'), { timeout: 10000 }).catch(() => null);
const splash = await page.evaluate(() => document.body.innerText);
await shot('state-offline');
check('unreachable server at startup shows a retrying splash, not sign-in', /retrying/i.test(splash) && !/Welcome back/.test(splash), splash.trim().slice(0, 60));
check('session token survives the outage', !!(await page.evaluate(() => localStorage.getItem('ft.token'))));
rule = null;
const back = await page.waitForSelector('main h1', { timeout: 10000 }).then(() => true, () => false);
check('app recovers by itself when the server comes back', back);

// ---- 5. Offline after load ---------------------------------------------------
await navClient('/goals');
await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Goals', { timeout: 8000 });
await navClient('/');
await ready();
rule = (u) => (u.includes('/api/') ? 'abort' : null);
await navClient('/goals');
const stayed = await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Goals', { timeout: 5000 }).then(() => true, () => false);
check('already-loaded pages stay usable offline', stayed);
await navClient('/invest');
await page.waitForSelector('[data-testid=error-state]', { timeout: 10000 }).catch(() => null);
const off = await page.evaluate(() => document.querySelector('[data-testid=error-state]')?.innerText ?? '');
check('a page never loaded before shows the offline error', /Can't reach Fintrack/.test(off), off.slice(0, 40));
rule = null;

// ---- 6. 404 & failed page download -----------------------------------------
await page.goto(BASE + '/definitely-not-a-page', { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-testid=not-found]', { timeout: 8000 });
await shot('state-404');
const nf = await page.$eval('[data-testid=not-found]', (e) => e.innerText);
check('unknown URL shows the 404 page inside the app shell', !!(await page.$('aside')) && nf.includes('doesn’t exist'));

rule = (u) => (u.includes('/src/pages/Projections') ? 'abort' : null);
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await ready();
await navClient('/projections');
await page.waitForSelector('[data-testid=crash-state]', { timeout: 8000 }).catch(() => null);
const crash = await page.evaluate(() => document.querySelector('[data-testid=crash-state]')?.innerText ?? '');
await shot('state-chunk-failed');
check('a page that fails to download shows a reload prompt, sidebar intact', /didn’t download/.test(crash) && !!(await page.$('aside')), crash.slice(0, 40));
rule = null;
await navClient('/reports');
const away = await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Reports', { timeout: 8000 }).then(() => true, () => false);
check('navigating away from a crashed page works', away);

// ---- 7. Empty states with a brand-new account -------------------------------
const email = `empty-${Date.now()}@fintrack.test`;
const reg = await (
  await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Newbie', email, password: `pw-${Math.random().toString(36).slice(2)}`, country: 'RO' }),
  })
).json();
await page.evaluate((t) => localStorage.setItem('ft.token', t), reg.token);
const empties = {
  '/': "Let's set up your money",
  '/accounts': 'No accounts yet',
  '/transactions': 'No transactions yet',
  '/spending': 'No spending yet',
  '/reports': 'No data to report yet',
  '/insights': 'No insights yet',
  '/projections': 'Not enough history yet',
  '/goals': 'What are you saving for?',
  '/invest': 'Not enough history yet',
  '/family': 'Start a family',
};
for (const [path, text] of Object.entries(empties)) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  const ok = await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 8000 }, text).then(() => true, () => false);
  check(`empty state on ${path}`, ok, ok ? text : `missing "${text}"`);
  const bad = await page.evaluate(() => /NaN|Infinity|undefined/.test(document.body.innerText));
  if (bad) check(`no NaN/undefined text on ${path}`, false);
  if (path === '/') await shot('state-empty-home');
  if (path === '/transactions') await shot('state-empty-activity');
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
