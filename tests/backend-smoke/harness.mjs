// Shared harness: runs backend functions locally against real BTC daily bars,
// with the Base44 client, the language model and outside services stubbed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
// ---- real BTC bars served as a Yahoo chart response
export const rows = fs.readFileSync(path.join(here, 'BTC_daily.csv'),'utf8').trim().split('\n').slice(1).map(l=>l.split(','));
const yahoo = () => ({ chart: { result: [{ timestamp: rows.map(r=>Math.floor(new Date(r[0]).getTime()/1000)),
  indicators: { quote: [{ close: rows.map(r=>+r[4]), high: rows.map(r=>+r[2]), low: rows.map(r=>+r[3]), volume: rows.map(r=>+r[5]) }] } }] } });
export const posted = [];
globalThis.fetch = async (url, opts={}) => {
  const u = String(url);
  if (u.includes('finance.yahoo.com')) return new Response(JSON.stringify(yahoo()), { status: 200 });
  if (u.includes('discord') ) { posted.push({u, body: opts.body}); return new Response('{}', {status:200}); }
  return new Response('{}', { status: 200 });
};
export const llmCalls = [];
export const writes = [];
export const mkBase44 = (user) => {
  const entity = new Proxy({}, { get: (_, m) => async (...a) => { writes.push({ m, a }); return (m === 'create' ? { id: 'x1', ...a[0] } : m === 'update' ? {} : []); } });
  const entities = new Proxy({}, { get: () => entity });
  const InvokeLLM = async (o) => {
    llmCalls.push(o);
    const props = o.response_json_schema?.properties || {};
    if (props.intent) return { intent: 'analytical' };
    if (props.factual_summary) return { factual_summary: 'stub facts', needs_engine: false, sources: [], warrants_citation: false };
    if (props.response) return { receiving: 'r', response: 'STUB REPLY', boundary_signal: '' };
    if (props.message) return { message: 'stub discord message' };
    if (props.discord_elaboration) return { discord_elaboration: 'stub elaboration', x_reply: 'stub' };
    if (props.memory_summary) return { memory_summary: 'm', topics_discussed: 't', user_style: 's' };
    return 'stub';
  };
  return { auth: { me: async () => { if (!user) { const e = new Error('unauth'); e.status = 401; throw e; } return user; } },
    entities, asServiceRole: { entities, functions: { invoke: async () => ({ data: {} }) } },
    integrations: { Core: { InvokeLLM, SendEmail: async () => ({}) } } };
};
let handler = null;
globalThis.Deno = { serve: (h) => { handler = h; }, env: { get: (k) => ({ DISCORD_SIGNALS_WEBHOOK_URL: 'https://discord.test/hook', DISCORD_WEBHOOK_URL: 'https://discord.test/hook2', X_BEARER_TOKEN:'a',X_API_KEY:'a',X_API_SECRET:'a',X_ACCESS_TOKEN:'a',X_ACCESS_TOKEN_SECRET:'a' })[k] } };
export const load = async (fn) => { handler = null; const m = await import(`${path.join(here, 'out', fn + '.mjs')}?${Math.random()}`); return handler || m.default; };
export const call = async (h, user, body) => { globalThis.__base44 = mkBase44(user); llmCalls.length = 0;
  const res = await h(new Request('https://app.test/fn', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() }; };
export const sub = { email: 'u@test.com', full_name: 'Test User', role: 'user', subscription_status: 'active' };
export const out = (label, v) => console.log(`\n=== ${label}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}`);
export const synthPrompt = () => (llmCalls.find(c => c.response_json_schema?.properties?.response)?.prompt || '');
