// Deployment: production by default; a test app (HEX_ENV=test) tags its rows
// and posts nothing in public.
//   node tests/deployment.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'backend-smoke', 'out'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'deployment.mjs');
fs.writeFileSync(path.join(outDir, '_deployment_entry.ts'), [
  "export * from '../../../base44/shared/deployment.ts';",
  "export { postDiscord } from '../../../base44/shared/discord.ts';",
  "export { rowsFor } from '../../../base44/shared/ledger.ts';",
  "export { runEngines } from '../../../base44/shared/engines.ts';",
].join('\n'));
await build({ entryPoints: [path.join(outDir, '_deployment_entry.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });

let fails = 0; const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) fails++; };
const env = {};
globalThis.Deno = { env: { get: (k) => env[k] } };
let fetched = 0; globalThis.fetch = async () => { fetched++; return { ok: true, json: async () => ({}) }; };
const m = await import(out);

// production by default: nothing set means nothing changes
check('unset means production', m.deployment() === 'production' && m.postsAllowed());
for (const v of ['production', 'prod', 'live', '', 'anything']) { env.HEX_ENV = v; check(`HEX_ENV=${JSON.stringify(v)} is production`, m.deployment() === 'production'); }
for (const v of ['test', 'TEST', ' staging ', 'copy', 'dev']) { env.HEX_ENV = v; check(`HEX_ENV=${JSON.stringify(v)} is test`, m.deployment() === 'test' && !m.postsAllowed()); }

// a test deployment sends nothing to Discord
env.DISCORD_WEBHOOK_URL = 'https://discord.invalid/hook';
env.HEX_ENV = 'test'; fetched = 0;
check('test: Discord post not sent', (await m.postDiscord('hello')) === false && fetched === 0);
env.HEX_ENV = ''; fetched = 0;
check('production: Discord post sent', (await m.postDiscord('hello')) === true && fetched === 1);

// ledger rows carry the deployment; the calls themselves are identical
const closes = fs.readFileSync(path.join(here, 'backend-smoke', 'BTC_daily.csv'), 'utf8').trim().split('\n').slice(1).map((l) => Number(l.split(',').at(4))).filter(Number.isFinite).slice(-800);
const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
const bars = { closes, timestamps: closes.map((_, i) => 1.6e9 + i * 86400) };
const run = m.runEngines(returns);
const strip = (rows) => rows.map(({ made_at, deployment, ...r }) => r);
env.HEX_ENV = 'test'; const t = m.rowsFor('BTC', bars, returns, run, 'nightly');
env.HEX_ENV = ''; const p = m.rowsFor('BTC', bars, returns, run, 'nightly');
check('rows tagged by deployment', t.every((r) => r.deployment === 'test') && p.every((r) => r.deployment === 'production'), `${t.length} rows each`);
check('the calls are the same in both deployments', JSON.stringify(strip(t)) === JSON.stringify(strip(p)));

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
