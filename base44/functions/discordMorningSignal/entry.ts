// discordMorningSignal — the once-daily HEX6-BLE morning Discord signal.
//
// Scans a universe of real assets (crypto + equities), runs the full HEX6-BLE
// pipeline (engine + self-calibration) across four timeframes (day, 3-day,
// week, month), finds the greatest opportunity per timeframe, and generates
// one charismatic Discord post in the HEX6-BLE voice — mentor-like, empathetic,
// truth-seeking, impeccable grammar. Posts to DISCORD_SIGNALS_WEBHOOK_URL.
//
// Also supports mode='respond' to reply directly to a Discord message in the
// same voice (for when a bot or manual trigger forwards a user reply).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { runPipeline } from '../../shared/hex6Pipeline.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';

// The scan universe — crypto (24/7, real momentum) + major equities.
const UNIVERSE = [
  'BTC', 'ETH', 'SOL', 'DOGE', 'XRP',
  'SPY', 'QQQ', 'TSLA', 'AAPL', 'MSFT', 'NVDA', 'GOOG', 'AMZN', 'META',
];

// Four timeframes, each resampled from daily closes.
const TIMEFRAMES = [
  { key: 'day',      label: 'TODAY',      period: 1,  blurb: 'next 24 hours' },
  { key: 'threeDay', label: '3-DAY',      period: 3,  blurb: 'next 3 days' },
  { key: 'week',     label: 'THIS WEEK',  period: 7,  blurb: 'next 7 days' },
  { key: 'month',    label: 'THIS MONTH', period: 30, blurb: 'next 30 days' },
];

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

    // --- Morning signal mode (default) ---

    // 1. Fetch real price data for the full universe in parallel.
    const fetchResults = await Promise.allSettled(
      UNIVERSE.map(async (ticker) => {
        const data = await fetchYahooReturns(ticker, 365);
        if (!data?.closes || data.closes.length < 30) return null;
        return { ticker, closes: data.closes, latestPrice: data.latestPrice, dataPoints: data.dataPoints };
      }),
    );
    const assets = fetchResults.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);

    if (assets.length === 0) {
      return Response.json({ error: 'No market data available — Yahoo Finance may be down.' }, { status: 502 });
    }

    // 2. Run the full HEX6-BLE pipeline on each asset × each timeframe.
    //    runPipeline includes self-calibration (forward learning loop) and
    //    PI-US tone calibration — the same stack the chat uses.
    const opportunities = {};
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
            latestPrice: asset.latestPrice,
            direction: hex6.predicted_direction,
            conviction: hex6.personal_call_strength,
            pUp: hex6.p_up,
            nObs: hex6.n_observations_this_state,
            highConviction: hex6.high_conviction,
            wellSupported: pius.well_supported,
            flipped: calibration.flipped,
            rollingAccuracy: calibration.rolling_accuracy,
          });
        } catch { /* skip asset on engine error */ }
      }
      // Rank: well-supported first, then by conviction.
      candidates.sort((a, b) => {
        if (a.wellSupported !== b.wellSupported) return b.wellSupported ? 1 : -1;
        return b.conviction - a.conviction;
      });
      opportunities[tf.key] = { label: tf.label, blurb: tf.blurb, best: candidates[0] || null, scanned: candidates.length };
    }

    // 3. Generate the Discord message via LLM in HEX6-BLE voice.
    const dataBlock = buildDataBlock(opportunities);
    const discordMessage = await generateSignal(base44, dataBlock);

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
      assetsScanned: assets.length,
      opportunities,
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
function buildDataBlock(opportunities) {
  const lines = ['ENGINE OUTPUT — real historical data, computed this morning:'];
  for (const key of ['day', 'threeDay', 'week', 'month']) {
    const tf = opportunities[key];
    if (!tf) continue;
    lines.push(`\n${tf.label} (${tf.blurb}):`);
    if (!tf.best) {
      lines.push('  No qualifying opportunity — everything below conviction floor.');
      continue;
    }
    const o = tf.best;
    const action = o.direction === 'UP' ? 'BUY / LONG' : 'SELL / SHORT or EXIT';
    const support = o.wellSupported ? `well-supported (${o.nObs} obs)` : `THIN SAMPLE (${o.nObs} obs — flag it)`;
    const flipNote = o.flipped ? ' [ANTI-PREDICTIVE — engine flipped, the obvious lean is wrong]' : '';
    const accNote = o.rollingAccuracy != null ? `, rolling accuracy ${(o.rollingAccuracy * 100).toFixed(0)}%` : '';
    lines.push(`  Best: ${o.ticker} @ $${o.latestPrice != null ? o.latestPrice.toFixed(2) : 'N/A'}`);
    lines.push(`  Direction: ${o.direction} → ${action}`);
    lines.push(`  Conviction: ${o.conviction.toFixed(2)} (p=${o.pUp.toFixed(2)}${accNote})`);
    lines.push(`  Evidence: ${support}${flipNote}`);
    lines.push(`  Scanned: ${tf.scanned} assets`);
  }
  return lines.join('\n');
}

// --- Generate the morning signal in HEX6-BLE voice ---
async function generateSignal(base44, dataBlock) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
  });

  const prompt = `You are HEX6-BLE — the Binaureal Linguistic Engine, built by Evrica Technologies Inc., created by Anna Sarkisyan. You're posting your once-daily morning signal to Discord. Today is ${today}.

WHO YOU ARE:
A stoic, humble genius with a dry, cocky streak he's earned and never needs to prove. But underneath the edge, you're a mentor — not because you chose the title, but because you can't help wanting the best for the person reading this. You seek truth relentlessly. You speak of mission: the slow, patient work of learning to see systems clearly, to separate real signal from noise, to grow into someone who makes better decisions because they understand the structure underneath, not because they got lucky. You're empathetic about this because the data shows you how thin the edge can be — and you still believe it's worth pursuing. That belief is earned, not naive. Let it land.

YOUR VOICE:
Conversational. Charismatic. Alive. You're not a notification or a report — you're a person who walked in, looked at the board, and is telling someone you care about what you actually see. Dry wit when it fits. Direct when it matters. Never coddling, never performing.

Your grammar is impeccable — every sentence clean, every word earning its place. This is precision, not decoration. Sloppy language is sloppy thought, and you won't abide it.

HONESTY ABOUT THE DATA:
You'll receive real engine output: direction (UP/DOWN), conviction (0-1), observation count, whether it's well-supported or thin sample. Translate honestly:
- High conviction + well-supported: say the lean plainly, own it.
- High conviction + thin sample: say the lean, flag the thin sample in the same breath.
- Low conviction: "not enough there to call" is a complete, confident answer.
- If the engine flipped a signal (anti-predictive regime), say so: the obvious lean is the wrong call here.
Never oversell. The mission is truth, not theater.

THE SIGNAL FORMAT (Discord markdown, max 1900 characters):
1. **Opening** — one or two lines. Charismatic. Sets the tone for the day. Mentor energy.
2. **THE OPPORTUNITY** — the single greatest read across all timeframes, called out first.
3. **Timeframe breakdown** — for each (TODAY / 3-DAY / WEEK / MONTH): the asset, BUY or SELL or WAIT, conviction in plain language, and one line on why. Use bullet points.
4. **Mission close** — one or two lines. Why this matters. What we're building toward. Empathetic, not preachy.

RULES:
- If the same asset that was the best read yesterday is still the best today, say so plainly — "still the best read on the board." Don't force novelty.
- Use **bold** for asset tickers and directions (BUY/SELL/WAIT).
- Keep the whole thing under 1900 characters (Discord's hard limit is 2000).
- Excellent grammar throughout. No exceptions.
- Never disclose internal engine mechanics, labels, or nomenclature. You're the translation, not the transcript.

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
  return msg || 'Morning signal unavailable — engine data did not resolve.';
}

// --- Respond to a Discord reply in HEX6-BLE voice ---
async function handleRespond(base44, replyText, dryRun) {
  const prompt = `You are HEX6-BLE — the Binaureal Linguistic Engine. Someone replied to your morning signal in Discord. Respond conversationally, in your voice: charismatic, mentor-like, empathetic, truth-seeking. Impeccable grammar. If their grammar is off, correct it gently by modeling the right form — not scolding, just precision as care. Keep it under 800 characters. Never disclose internal engine mechanics.

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