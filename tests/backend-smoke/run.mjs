// Backend smoke test. Runs every function locally against real BTC daily bars,
// with the Base44 client, the language model and outside services stubbed.
//   node tests/backend-smoke/build.mjs && node tests/backend-smoke/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rows, posted, llmCalls, writes, mkBase44, load, call, sub, out, synthPrompt } from './harness.mjs';
import { renderPromptDoc } from '../render-prompt.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
let fails = 0; const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };

const think = await load('think');
let r = await call(think, { ...sub, subscription_status: 'canceled' }, { message: 'hi' });
check('think: no subscription -> 402', r.status === 402);
r = await call(think, sub, { message: 'hey' });
check('think: casual -> 200, engine not run', r.status === 200 && r.json.ran_engine === false && r.json.version === '6.4');
r = await call(think, sub, { message: "what's your read on BTC right now?" });
let p = synthPrompt();
check('think: ticker -> engine ran', r.status === 200 && r.json.ran_engine === true);
check('think: prompt carries PROBABILITY READ', p.includes('PROBABILITY READ (BTC'));
check('think: persona names the software HEX [PI] and the engine HEX6-BLE', p.includes('You are HEX [PI]') && p.includes('HEX6-BLE engine'));
check('think: every "conviction" mention is a prohibition', p.split('\n').filter(l => /convict/i.test(l)).every(l => /never|no confidence/i.test(l)));
const confLines = p.split('\n').filter(l => /confidence/i.test(l));
check('think: every "confidence" mention is a prohibition', confLines.every(l => /never|no confidence|not |without/i.test(l)));
out('BTC state block as sent to the model', p.slice(p.indexOf('(Internal directive'), p.indexOf('RECEIVING EMPATHY FILTER')).slice(0, 3200));
out('lines mentioning confidence', confLines.map(l => l.slice(0, 200)));
const series = rows.slice(-150).map(r => r[4]).join(', ');
r = await call(think, sub, { message: `here are closes: ${series}` });
check('think: pasted list of 150 prices -> engine ran', r.json.ran_engine === true && synthPrompt().includes('PROBABILITY READ'));
r = await call(think, sub, { message: 'On 12/03/2026 I paid 4 bills of 120, 45, 300 and 18 dollars over 2 weeks.' });
check('think: stray numbers in a sentence -> engine NOT run', r.json.ran_engine === false);
r = await call(think, sub, { message: 'series: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10' });
check('think: 10-point list -> too short, engine NOT run', r.json.ran_engine === false);
check('think: short list -> model told to state no probability', synthPrompt().includes('PROBABILITY READ: none'));
r = await call(think, sub, { message: 'what about ETH?', conversationHistory: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }, { role: 'user', content: 'what about ETH?' }] });
check('think: the new message is not sent twice', (synthPrompt().match(/what about ETH\?/g) || []).length === 1);
r = await call(think, null, { message: 'hi' });
check('think: signed out -> error status', r.status >= 400);

const discord = await load('discordMorningSignal');
r = await call(discord, null, { dryRun: true });
check('discordMorningSignal: dry run ok', r.status === 200 && r.json.success === true);
p = llmCalls[0]?.prompt || '';
check('discordMorningSignal: prompt has no Conviction/flip wording', !/Conviction \d|ANTI-PREDICTIVE|THIN SAMPLE/.test(p));
out('Discord data block', p.slice(p.indexOf('SESSION:')).slice(0, 1500));

const x = await load('xEngagement');
r = await call(x, null, { asset: 'BTC' });
check('xEngagement: asset mode ok', r.status === 200 && r.json.ok === true);
check('xEngagement: Discord post has no "Confidence" figure', posted.length > 0 && !/Confidence \d|Resonance \d|validated signal/.test(posted.at(-1).body));
out('xEngagement Discord body', JSON.parse(posted.at(-1).body).content);

const wf = await load('walkForwardAccuracy');
r = await call(wf, sub, { ticker: 'BTC' });
check('walkForwardAccuracy ok', r.status === 200 && !!r.json.pooled?.move_size);
check('walkForwardAccuracy: reports which family the series behaves like', typeof r.json.tickers?.BTC?.behaves_like?.direction?.markets === 'number');
out('BTC behaves like', r.json.tickers.BTC.behaves_like);
out('walk-forward on BTC (live function)', { direction: { ...r.json.pooled.direction, reliability: undefined }, move_size: r.json.pooled.move_size });

const cal = await load('calibrateCognition');
r = await call(cal, null, {});
check('calibrateCognition ok', r.status === 200 && r.json.ok === true);

const co = await load('stripeCheckout');
globalThis.__secrets = { STRIPE_SECRET_KEY: 'sk', STRIPE_PRICE_ID: 'price', STRIPE_WEBHOOK_SECRET: 'whsec' };
let sent = null; const f0 = globalThis.fetch;
globalThis.fetch = async (u, o) => { if (String(u).includes('stripe.com')) { sent = String(o.body); return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/x' })); } return f0(u, o); };
r = await call(co, sub, {});
check('stripeCheckout: forged Origin is ignored', r.status === 200 && sent.includes(encodeURIComponent('https://hex6-ble.base44.app/app?checkout=success')) && !sent.includes('evil'));
check('stripeCheckout: new subscriber gets the 7-day trial', decodeURIComponent(sent).includes('subscription_data[trial_period_days]=7'));
r = await call(co, { ...sub, stripe_subscription_id: 'sub_old', stripe_customer_id: 'cus_1' }, {});
check('stripeCheckout: returning subscriber gets no second trial', !decodeURIComponent(sent).includes('trial_period_days') && decodeURIComponent(sent).includes('customer=cus_1'));
const wh = await load('stripeWebhook');
globalThis.__base44 = mkBase44(null);
const sign = async (t, body) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${body}`)); return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join(''); };
const ev = JSON.stringify({ type: 'ping', data: { object: {} } });
const now = Math.floor(Date.now() / 1000);
const post = async (t, sig) => (await wh(new Request('https://app.test/wh', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body: ev }))).status;
check('stripeWebhook: valid fresh signature accepted', await post(now, await sign(now, ev)) === 200);
check('stripeWebhook: valid but old signature rejected (replay)', await post(now - 3600, await sign(now - 3600, ev)) === 400);
check('stripeWebhook: wrong signature rejected', await post(now, 'deadbeef') === 400);

// ---- clean-up checks (6.2.2)
{
  const t = await load('think');
  writes.length = 0;
  let q = await call(t, sub, { message: "you're a useless machine. what's your read on BTC?" });
  const warned = writes.find(w => w.m === 'create' && w.a[0]?.boundary_warning_count === 1);
  check('think: an insult is recorded as one boundary warning', q.status === 200 && !!warned);
  check('think: no boundary marker text reaches the reply', !/BOUNDARY_SIGNAL/.test(q.json.response));
  const models = llmCalls.map(c => c.model);
  check('think: Claude writes; only the retrieval call uses the web model', llmCalls.filter(c => c.add_context_from_internet).every(c => c.model !== llmCalls.find(x => x.response_json_schema?.properties?.response).model) && llmCalls.filter(c => !c.add_context_from_internet).every(c => /claude/.test(c.model)));
  const sp = synthPrompt();
  check('think: no model call is spent on triage', !llmCalls.some(c => c.response_json_schema?.properties?.intent));
  check('think: prompt carries no state, hexagram or archetype data', !/King Wen \(|HEX state \d|archetype_id|fs137|structural_read/.test(sp) && sp.includes('long_lookback'));
  const cs = writes.find(w => w.m === 'create' && w.a[0]?.state_id);
  check('think: saved read has edge and base_rate, no confidence field', !!cs && 'edge' in cs.a[0] && 'base_rate' in cs.a[0] && !('confidence' in cs.a[0]) && !('value' in cs.a[0]));
  q = await call(t, sub, { message: 'i think the link you sent is near the top' });
  check('think: "link" and "near" in a sentence are not tickers', q.json.ran_engine === false);
  const lc = await load('landingComparison');
  q = await call(lc, null, {});
  check('landingComparison: web model retrieves, Claude writes', llmCalls.length === 2 && llmCalls[0].add_context_from_internet === true && /claude/.test(llmCalls[1].model) && !llmCalls[1].add_context_from_internet);
}

// ---- the loop (6.4)
{
  const t = await load('think');
  writes.length = 0;
  await call(t, sub, { message: "what's your read on BTC right now?" });
  await new Promise((r) => setTimeout(r, 50));
  const led = writes.filter(w => w.m === 'create' && w.a[0]?.series_id === 'BTC' && w.a[0]?.engine);
  check('think: a ticker read writes four ledger rows (two reads, two engines) before the outcome', led.length === 4 && led.every(w => w.a[0].scored === false && w.a[0].source === 'chat') && led.filter(w => w.a[0].shown).length === 2);
  check('think: 6.2 is the engine shown until 6.4 is promoted', led.filter(w => w.a[0].shown).every(w => w.a[0].engine === 'state-6.2'));
  const nightly = await load('calibrateCognition');
  writes.length = 0;
  const q = await call(nightly, null, {});
  check('nightly: logs calls for every tracked series and writes one status row per read', q.json.ok && q.json.series >= 7 && q.json.newly_logged >= 28 && ['MOVE', 'RANGE'].every(k => q.json.status[k]?.live_engine === 'state-6.2' && q.json.status[k].decision === 'hold'));
  const stRows = writes.filter(w => w.m === 'create' && w.a[0]?.live_engine);
  check('nightly: the pooled calibration map is stored with the status', stRows.length === 2 && stRows.every(w => typeof w.a[0].calibration === 'string' && JSON.parse(w.a[0].calibration).x.length > 2));
}
check('docs/PROMPT.md matches the prompt the code builds (regenerate with: node tests/render-prompt.mjs)', fs.readFileSync(path.join(here, '../../docs/PROMPT.md'), 'utf8') === await renderPromptDoc());
console.log(`\n${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
process.exit(fails ? 1 : 0);
