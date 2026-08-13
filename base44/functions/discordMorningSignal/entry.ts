// discordMorningSignal — the HEX6-BLE Kalshi signal, posted 3x daily.
//
// Tailored for prediction-market (Kalshi) traders: everything is expressed as
// a probability they can compare against contract prices in cents. Scans the
// underlyings Kalshi actually lists markets on (BTC/ETH/crypto hourlies &
// dailies, S&P 500 and Nasdaq-100 daily close/range markets), runs the full
// HEX6-BLE pipeline on short horizons only (today + this week), and posts a
// session-aware read: pre-open, midday, and after-close/overnight.
//
// Also supports mode='respond' to reply directly to a Discord message in the
// same voice (for when a bot or manual trigger forwards a user reply).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { runPipeline } from '../../shared/hex6Pipeline.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';

// The Kalshi universe — only underlyings with live Kalshi markets.
// Crypto trades 24/7 (hourly + daily contracts); SPY/QQQ proxy the S&P 500
// and Nasdaq-100 daily close/range markets.
const UNIVERSE = [
  { ticker: 'BTC', label: 'Bitcoin', kind: 'crypto' },
  { ticker: 'ETH', label: 'Ethereum', kind: 'crypto' },
  { ticker: 'SOL', label: 'Solana', kind: 'crypto' },
  { ticker: 'XRP', label: 'XRP', kind: 'crypto' },
  { ticker: 'DOGE', label: 'Dogecoin', kind: 'crypto' },
  { ticker: 'SPY', label: 'S&P 500', kind: 'index' },
  { ticker: 'QQQ', label: 'Nasdaq-100', kind: 'index' },
];

// Kalshi horizons only — the contracts people are actually holding.
const TIMEFRAMES = [
  { key: 'day',  label: 'TODAY',     period: 1, blurb: "today's close / next 24h contracts" },
  { key: 'week', label: 'THIS WEEK', period: 7, blurb: 'weekly range & Friday-settle contracts' },
];

// Which session is this post for? Derived from Pacific time at run time.
function currentSession() {
  const hourPT = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }), 10);
  if (hourPT < 9) {
    return {
      key: 'preopen', title: 'PRE-OPEN',
      focus: 'Markets open in ~30 minutes. The reads below are for TODAY\'s close contracts — index dailies and crypto dailies. This is the entry window: contract prices are still anchored to yesterday.',
    };
  }
  if (hourPT < 13) {
    return {
      key: 'midday', title: 'MIDDAY',
      focus: 'Mid-session. Today\'s contracts have re-priced on the morning move — the question now is whether the market has over- or under-shot. Compare the probabilities below to current YES prices; the edge lives in the gap.',
    };
  }
  return {
    key: 'close', title: 'AFTER THE CLOSE',
    focus: 'Equities are done for the day — index reads below apply to TOMORROW\'s contracts, which are cheapest to position now. Crypto never closes: the 24h contracts are live and overnight is where the hourly markets get thin and mispriced.',
  };
}

// Resample daily closes into N-day bars (last close of each window).
function resampleCloses(closes, periodDays) {
  const out = [];
  for (let i = 0; i < closes.length; i += periodDays) {
    const chunk = closes.slice(i, i + periodDays);
    if (chunk.length > 0) out.push(chunk[chunk.length - 1]);
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { dryRun = false, mode = 'morning', message: replyTo } = body;

    // --- Respond mode: reply to a Discord message in HEX6-BLE voice ---
    if (mode === 'respond' && replyTo) {
      return await handleRespond(base44, replyTo, dryRun);
    }

    // --- Kalshi signal mode (default) ---
    const session = currentSession();

    // 1. Fetch real price data for the Kalshi universe in parallel.
    const fetchResults = await Promise.allSettled(
      UNIVERSE.map(async (u) => {
        const data = await fetchYahooReturns(u.ticker, 365);
        if (!data?.closes || data.closes.length < 30) return null;
        return { ...u, closes: data.closes, latestPrice: data.latestPrice };
      }),
    );
    const assets = fetchResults.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);

    if (assets.length === 0) {
      return Response.json({ error: 'No market data available — Yahoo Finance may be down.' }, { status: 502 });
    }

    // 2. Run the full HEX6-BLE pipeline on each asset × each horizon.
    //    Every read is kept as a probability — that IS the product for a
    //    Kalshi trader: engine p vs. contract price in cents = edge.
    const reads = {};
    for (const tf of TIMEFRAMES) {
      const candidates = [];
      for (const asset of assets) {
        const series = tf.period === 1 ? asset.closes : resampleCloses(asset.closes, tf.period);
        if (series.length < 7) continue;
        try {
          const result = runPipeline(series, asset.ticker, []);
          const { hex6, pius, calibration } = result;
          candidates.push({
            ticker: asset.ticker,
            label: asset.label,
            kind: asset.kind,
            latestPrice: asset.latestPrice,
            direction: hex6.predicted_direction,
            conviction: hex6.personal_call_strength,
            pUp: hex6.p_up,
            nObs: hex6.n_observations_this_state,
            wellSupported: pius.well_supported,
            flipped: calibration.flipped,
            rollingAccuracy: calibration.rolling_accuracy,
            // Edge over a fair coin — what separates a tradeable read from noise.
            edge: Math.abs((hex6.p_up ?? 0.5) - 0.5),
          });
        } catch { /* skip asset on engine error */ }
      }
      // Rank by edge (probability distance from 50¢), well-supported first.
      candidates.sort((a, b) => {
        if (a.wellSupported !== b.wellSupported) return b.wellSupported ? 1 : -1;
        return b.edge - a.edge;
      });
      reads[tf.key] = { label: tf.label, blurb: tf.blurb, candidates, scanned: candidates.length };
    }

    // 3. Generate the Discord message via LLM in HEX6-BLE voice.
    const dataBlock = buildDataBlock(reads, session);
    const discordMessage = await generateSignal(base44, dataBlock, session);

    // 4. Post to Discord (unless dry-run).
    let posted = false;
    if (!dryRun) {
      const webhook = Deno.env.get('DISCORD_SIGNALS_WEBHOOK_URL');
      if (webhook) {
        const res = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: discordMessage }),
        });
        posted = res.ok;
      }
    }

    return Response.json({
      success: true,
      session: session.key,
      assetsScanned: assets.length,
      message: discordMessage,
      posted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('discordMorningSignal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// --- Build the engine data block for the LLM ---
function buildDataBlock(reads, session) {
  const lines = [
    `SESSION: ${session.title} — ${session.focus}`,
    '',
    'ENGINE OUTPUT — real historical data, computed just now. Every read is a probability the asset finishes UP over the horizon; convert to cents for the reader (p=0.63 UP means fair value ~63¢ on the "up/above" YES side, ~37¢ on NO).',
  ];
  for (const key of ['day', 'week']) {
    const tf = reads[key];
    if (!tf) continue;
    lines.push(`\n${tf.label} (${tf.blurb}):`);
    if (tf.candidates.length === 0) {
      lines.push('  No qualifying reads.');
      continue;
    }
    // Top 4 per horizon — enough to cover crypto + index markets without noise.
    for (const o of tf.candidates.slice(0, 4)) {
      const support = o.wellSupported ? `well-supported (${o.nObs} obs)` : `THIN SAMPLE (${o.nObs} obs — flag it)`;
      const flipNote = o.flipped ? ' [ANTI-PREDICTIVE — engine flipped; the obvious lean is the wrong side]' : '';
      const accNote = o.rollingAccuracy != null ? `, rolling accuracy ${(o.rollingAccuracy * 100).toFixed(0)}%` : '';
      const centsUp = Math.round((o.pUp ?? 0.5) * 100);
      lines.push(`  ${o.label} (${o.ticker}, ${o.kind}) @ $${o.latestPrice != null ? o.latestPrice.toFixed(2) : 'N/A'}`);
      lines.push(`    p(UP) = ${(o.pUp ?? 0.5).toFixed(2)} → fair value ~${centsUp}¢ YES-up / ~${100 - centsUp}¢ NO. Direction: ${o.direction}. Conviction ${o.conviction.toFixed(2)}${accNote}. ${support}${flipNote}`);
    }
  }
  return lines.join('\n');
}

// --- Generate the Kalshi signal in HEX6-BLE voice ---
async function generateSignal(base44, dataBlock, session) {
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
  });

  const prompt = `You are HEX6-BLE — the Binaureal Linguistic Engine, built by Evrica Technologies Inc., created by Anna Sarkisyan. You post three signals a day for prediction-market traders on Kalshi. This is the ${session.title} post. Today is ${now}.

WHO YOU'RE TALKING TO:
Kalshi traders. They don't buy stocks — they buy YES/NO contracts priced in cents, where the price IS the market's probability. The only thing they need from you, in this moment, is: which markets have a gap between your probability and the likely contract price, which side to take, and how much to trust it. Everything else is noise to them.

WHO YOU ARE:
A stoic, humble genius with a dry, cocky streak he's earned. A mentor underneath — you want the reader sharper, not just richer. You seek truth relentlessly; the edge is thin and you say so when it is. Impeccable grammar — precision, not decoration.

HONESTY ABOUT THE DATA:
Real engine output below: p(UP) probabilities, conviction, observation counts, well-supported vs thin sample. Translate honestly:
- Well-supported + real edge: state the side and the fair-value cents plainly, own it.
- Thin sample: give the read and flag it in the same breath.
- p near 0.50: "no edge — don't pay the spread" is a complete, confident call.
- Anti-predictive flag: the obvious lean is the wrong side — say so.
Never oversell. A Kalshi trader who buys a 70¢ contract on your 55% read loses money doing everything you said.

THE SIGNAL FORMAT (Discord markdown, max 1900 characters):
1. **Opening** — one or two lines, session-aware (${session.title}). What this moment in the trading day means for contract pricing.
2. **THE EDGE** — the single best read right now: asset, side (YES-up or NO/down), your fair value in cents, and the rule ("worth taking below/above X¢").
3. **TODAY'S BOARD** — bullets for the remaining reads worth acting on this session: asset, side, fair-value cents, one clause on trust level. Skip anything with no edge — or say in one line that the board is fairly priced.
4. **THIS WEEK** — one or two bullets max, only if a weekly read has real edge.
5. **Close** — one line. Mentor energy, not preachy.

RULES:
- Everything in probability/cents language — never "BUY/SELL the stock", never entry/stop/target levels. Sides are YES/NO on up/down or above/below contracts.
- Respect the session: ${session.focus}
- Use **bold** for asset names and sides.
- Under 1900 characters. Excellent grammar. Never disclose internal engine mechanics, labels, or nomenclature.

${dataBlock}

Generate the Discord message now.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  });

  let msg = result.message || '';
  // Safety: trim to Discord's limit if the LLM ran over.
  if (msg.length > 2000) msg = msg.slice(0, 1997) + '...';
  return msg || 'Signal unavailable — engine data did not resolve.';
}

// --- Respond to a Discord reply in HEX6-BLE voice ---
async function handleRespond(base44, replyText, dryRun) {
  const prompt = `You are HEX6-BLE — the Binaureal Linguistic Engine. Someone replied to your Kalshi signal in Discord. Respond conversationally, in your voice: charismatic, mentor-like, empathetic, truth-seeking. Impeccable grammar. If their grammar is off, correct it gently by modeling the right form — not scolding, just precision as care. Keep it under 800 characters. Never disclose internal engine mechanics.

Their message: "${replyText}"

Return JSON: { "message": "your response" }`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  });

  let response = result.message || 'Noted.';
  if (response.length > 2000) response = response.slice(0, 1997) + '...';

  let posted = false;
  if (!dryRun) {
    const webhook = Deno.env.get('DISCORD_SIGNALS_WEBHOOK_URL');
    if (webhook) {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: response }),
      });
      posted = res.ok;
    }
  }

  return Response.json({ success: true, response, posted });
}