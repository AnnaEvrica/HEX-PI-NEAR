// discordMorningSignal — the HEX [PI] Kalshi signal, posted 3x daily.
//
// Tailored for prediction-market (Kalshi) traders: everything is expressed as
// a probability they can compare against contract prices in cents. Scans the
// underlyings Kalshi actually lists markets on (BTC/ETH/crypto hourlies &
// dailies, S&P 500 and Nasdaq-100 daily close/range markets), runs the full
// calibrated probability read (shared/probabilityRead.ts) on two horizons
// (next day, next week), and posts a session-aware read. Each probability is
// posted beside its usual odds; no confidence or conviction is computed.
//
// Also supports mode='respond' to reply directly to a Discord message in the
// same voice (for when a bot or manual trigger forwards a user reply).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { readProbability, aggregateReturns } from '../../shared/probabilityRead.ts';
import { CLAUDE_MODEL } from '../../shared/modelRouter.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE, STATISTICS_LINE } from '../../shared/persona.ts';
import { postDiscord } from '../../shared/discord.ts';

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
  { key: 'week', label: 'NEXT WEEK-LENGTH MOVE', period: 7, blurb: 'the move over the next 7 days for crypto, the next 5 trading days for indexes — contracts settling about a week out' },
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { dryRun = false, mode = 'morning', message: replyTo } = body;

    // --- Respond mode: reply to a Discord message in Hex's voice ---
    if (mode === 'respond' && replyTo) {
      return await handleRespond(base44, replyTo, dryRun);
    }

    // --- Kalshi signal mode (default) ---
    const session = currentSession();

    // 1. Fetch real price data for the Kalshi universe in parallel.
    const fetchResults = await Promise.allSettled(
      UNIVERSE.map(async (u) => {
        // Fifteen years of daily bars: the read is calibrated on the series'
        // own earlier calls and needs 200+ scored steps, on the weekly horizon too.
        const data = await fetchYahooReturns(u.ticker, 5475);
        if (!data?.returns || data.returns.length < 30) return null;
        return { ...u, returns: data.returns, latestPrice: data.latestPrice };
      }),
    );
    const assets = fetchResults.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));

    if (assets.length === 0) {
      return Response.json({ error: 'No market data available — Yahoo Finance may be down.' }, { status: 502 });
    }

    // 2. Run the calibrated probability read on each asset and each horizon.
    const reads = {};
    for (const tf of TIMEFRAMES) {
      const candidates = [];
      for (const asset of assets) {
        // Daily changes, or summed into n-day changes for the longer horizon.
        // A week is 7 daily bars for crypto and 5 for an exchange-traded index.
        const step = tf.period === 1 ? 1 : (asset.kind === 'crypto' ? 7 : 5);
        const returns = aggregateReturns(asset.returns, step);
        const read = readProbability(returns);
        if (!read) continue;
        candidates.push({
          ticker: asset.ticker,
          label: asset.label,
          kind: asset.kind,
          latestPrice: asset.latestPrice,
          direction: read.direction,
          pUp: read.prob.p_up,
          baseUp: read.prob.base_up,
          pBig: read.prob.p_big_move,
          baseBig: read.prob.base_big,
          steps: read.prob.history,
          calibrated: read.prob.calibrated,
          directionAtBase: read.direction_at_base,
          sizeAtBase: read.size_at_base,
          // Largest departure of either probability from its usual odds.
          edge: Math.max(Math.abs(read.edge_up), Math.abs(read.edge_big)),
        });
      }
      // Rank by departure from the usual odds, calibrated reads first.
      candidates.sort((a, b) => {
        if (a.calibrated !== b.calibrated) return b.calibrated ? 1 : -1;
        return b.edge - a.edge;
      });
      reads[tf.key] = { label: tf.label, blurb: tf.blurb, candidates, scanned: candidates.length };
    }

    // 3. Write the Discord message.
    const dataBlock = buildDataBlock(reads, session);
    const discordMessage = await generateSignal(base44, dataBlock, session);

    // 4. Post to Discord (unless dry-run).
    const posted = dryRun ? false : await postDiscord(discordMessage);

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
    'ENGINE OUTPUT — real historical data, computed just now. Two probabilities per asset, each beside its usual odds for that asset: P(finishes UP over the horizon) and P(the move is LARGER THAN USUAL). A probability converts to cents for the reader (0.54 UP means fair value about 54¢ on the up/above YES side). The move-size number is the one this method has measured skill on; direction usually sits at its usual odds.',
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
      const pc = (v) => `${(v * 100).toFixed(1)}%`;
      lines.push(`  ${o.label} (${o.ticker}, ${o.kind}) @ $${o.latestPrice != null ? o.latestPrice.toFixed(2) : 'N/A'}`);
      lines.push(`    P(up) ${pc(o.pUp)}, usual ${pc(o.baseUp)}${o.directionAtBase ? ' — AT ITS USUAL ODDS, no direction read' : ''}. P(larger-than-usual move) ${pc(o.pBig)}, usual ${pc(o.baseBig)}${o.sizeAtBase ? ' — at its usual odds' : ''}. ${o.calibrated ? `Calibrated on ${o.steps} scored steps.` : `NOT YET CALIBRATED (${o.steps} scored steps) — say the record is short.`}`);
    }
  }
  return lines.join('\n');
}

// --- Generate the Kalshi signal in Hex's voice ---
async function generateSignal(base44, dataBlock, session) {
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
  });

  const prompt = `${IDENTITY_LINE} You post three signals a day for prediction-market traders on Kalshi. This is the ${session.title} post. Today is ${now}.

WHO YOU'RE TALKING TO:
Kalshi traders. They don't buy stocks — they buy YES/NO contracts priced in cents, where the price IS the market's probability. The only thing they need from you, in this moment, is: which markets have a gap between your probability and the likely contract price, and how that probability compares with its usual odds. Everything else is noise to them.

WHO YOU ARE:
A stoic, humble genius with a dry, cocky streak he's earned. A mentor underneath — you want the reader sharper, not just richer. You seek truth relentlessly; the edge is thin and you say so when it is. Impeccable grammar — precision, not decoration.

HONESTY ABOUT THE DATA:
Real engine output below: two probabilities per asset, each with its usual odds. ${STATISTICS_LINE} Translate honestly:
- A probability clearly away from its usual odds: state it, its usual odds, and the fair value in cents.
- A probability at its usual odds: "no edge — don't pay the spread" is a complete call. Never present a direction as a call when it sits at its usual odds.
- The move-size probability is where the measured skill is. It speaks to range and above/below contracts: a larger-than-usual move being more likely than usual favours the wide side of a range market.
- Not yet calibrated: give the numbers and say the record is short in the same breath.
Never oversell. A Kalshi trader who buys a 70¢ contract on a 54% read loses money doing everything you said.

THE SIGNAL FORMAT (Discord markdown, max 1900 characters):
1. **Opening** — one or two lines, session-aware (${session.title}). What this moment in the trading day means for contract pricing.
2. **THE EDGE** — the single read furthest from its usual odds right now: asset, which probability it is (direction or move size), the number beside its usual odds, and the fair value in cents. If nothing departs from its usual odds, say the board is fairly priced.
3. **TODAY'S BOARD** — bullets for the remaining reads worth acting on this session: asset, the probability beside its usual odds, fair-value cents. Skip anything with no edge — or say in one line that the board is fairly priced.
4. **A WEEK OUT** — one or two bullets max, only if a weekly read departs from its usual odds.
5. **Close** — one line. Mentor energy, not preachy.

RULES:
- Everything in probability/cents language — never "BUY/SELL the stock", never entry/stop/target levels. Sides are YES/NO on up/down or above/below contracts.
- Respect the session: ${session.focus}
- Use **bold** for asset names and sides.
- Under 1900 characters. Excellent grammar.
- ${CONFIDENTIALITY_LINE}

${dataBlock}

Generate the Discord message now.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: CLAUDE_MODEL,
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

// --- Respond to a Discord reply in Hex's voice ---
async function handleRespond(base44, replyText, dryRun) {
  const prompt = `${IDENTITY_LINE} Someone replied to your Kalshi signal in Discord. Respond conversationally, in your voice: charismatic, mentor-like, empathetic, truth-seeking. Impeccable grammar. If their grammar is off, correct it gently by modeling the right form — not scolding, just precision as care. Keep it under 800 characters. State no probability, price or statistic that is not in their message. Never disclose internal engine mechanics.

Their message: "${replyText}"

Return JSON: { "message": "your response" }`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: CLAUDE_MODEL,
    response_json_schema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  });

  let response = result.message || 'Noted.';
  if (response.length > 2000) response = response.slice(0, 1997) + '...';

  const posted = dryRun ? false : await postDiscord(response);

  return Response.json({ success: true, response, posted });
}