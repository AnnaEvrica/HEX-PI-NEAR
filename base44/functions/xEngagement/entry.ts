// HEX [PI] on X and Discord.
// Scheduled automation: searches X for high-engagement crypto/market tweets,
// runs the calibrated probability read (shared/probabilityRead.ts) on real
// daily bars for the asset named, posts a short reply on X, and a fuller note
// in Discord. Every probability is posted beside its usual odds; no
// confidence, conviction or exposure figure is computed or posted.
//
// Service-role (no user) — matches the app's existing scheduled-function pattern.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { readProbability, probabilityBlock, probabilityLine } from '../../shared/probabilityRead.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { CLAUDE_MODEL } from '../../shared/modelRouter.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE } from '../../shared/persona.ts';
import { postDiscord } from '../../shared/discord.ts';
import { loadLive } from '../../shared/ledger.ts';
import { DEFAULT_LIVE } from '../../shared/engines.ts';
import { HISTORY_DAYS } from '../../shared/universe.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// Categorized hunt — each niche gets its own search so high-volume categories
// (major crypto / equities) can't bury niche alpha (DAO staking, prediction
// markets, emerging alts). We pool ranked candidates across ALL categories,
// then pick the best overall — diversity surfaces, engagement still gates.
const SEARCH_CATEGORIES = [
  {
    name: 'major_markets',
    query: '(BTC OR ETH OR SOL OR bitcoin OR ethereum OR SPY OR QQQ OR NASDAQ) (bullish OR bearish OR pump OR dump OR rally OR crash OR target OR breakout OR support OR resistance) -is:retweet -is:reply lang:en',
  },
  {
    name: 'dao_staking',
    query: '("liquid staking" OR "restaking" OR "eigenlayer" OR "governance token" OR "yield farming" OR "dao vote" OR "staking rewards") (stake OR staking OR "apy" OR "yield" OR "dao" OR "voting" OR "governance" OR bullish OR bearish OR breakout) -is:retweet -is:reply lang:en',
  },
  {
    name: 'prediction_markets',
    query: '("Kalshi" OR "Polymarket" OR "prediction market" OR "event contract" OR "binary option") (bet OR bets OR "odds" OR "win" OR "yes" OR "no" OR "election" OR "forecast" OR bullish OR bearish OR target) -is:retweet -is:reply lang:en',
  },
  {
    name: 'emerging_alts',
    query: '("low cap" OR "lowcap" OR "gem" OR "narrative" OR "alpha call" OR "airdrop" OR "token launch" OR "altcoin") (breakout OR bullish OR "going up" OR pump OR target OR "watch list" OR "due diligence") -is:retweet -is:reply lang:en',
  },
];
const MAX_RESULTS = 100;            // recent-search cap per category
const ENGAGEMENT_FLOOR = 800;       // min (likes + retweets + replies + quotes) to consider
const TOP_N = 3;                     // tweets processed per run (across all categories)
const X_API = 'https://api.twitter.com/2';

// ---------------------------------------------------------------------------
// Helpers — X OAuth 1.0a (HMAC-SHA1) for posting replies
// ---------------------------------------------------------------------------
function pct(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
}

async function hmacSha1Base64(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function oauth1Header(method, url) {
  const consumerKey = Deno.env.get('X_API_KEY');
  const consumerSecret = Deno.env.get('X_API_SECRET');
  const token = Deno.env.get('X_ACCESS_TOKEN');
  const tokenSecret = Deno.env.get('X_ACCESS_TOKEN_SECRET');
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const sorted = Object.keys(oauth).sort()
    .map((k) => `${pct(k)}=${pct(oauth[k])}`).join('&');
  const base = `${method.toUpperCase()}&${pct(url)}&${pct(sorted)}`;
  const signingKey = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, base);
  const header = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.keys(header).map((k) => `${pct(k)}="${pct(header[k])}"`).join(', ');
}

async function xSearchRecent(query, maxResults) {
  const params = new URLSearchParams({
    query,
    max_results: String(maxResults),
    'tweet.fields': 'public_metrics,created_at,lang,author_id',
    expansions: 'author_id',
    'user.fields': 'username',
  });
  const res = await fetch(`${X_API}/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('X_BEARER_TOKEN')}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`X search ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function xPostReply(text, inReplyToId) {
  const url = `${X_API}/tweets`;
  const body = JSON.stringify({ text, reply: { in_reply_to_tweet_id: inReplyToId } });
  const auth = await oauth1Header('POST', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`X post ${res.status}: ${JSON.stringify(json)}`);
  return json?.data?.id || null;
}

// Real daily bars for a ticker, then the calibrated read. Returns null when
// the ticker has no usable price history (the post is then skipped).
async function readTicker(ticker, live = DEFAULT_LIVE) {
  try {
    const md = await fetchYahooReturns(ticker, HISTORY_DAYS);
    if (!md?.returns || md.returns.length < 250) return null;
    const read = readProbability(md.returns, live, md.returnDays);
    if (!read) return null;
    return { read, latestPrice: md.latestPrice, bars: md.dataPoints };
  } catch {
    return null;
  }
}

// The engine fields stored on the XEngagement record.
function statsOf(read) {
  return {
    probability: read.prob.p_up,
    // Distance of P(up) from its usual odds, in probability points.
    edge: Math.abs(read.edge_up),
    // FLAT records a direction read that sits at its usual odds.
    predicted_direction: read.direction_at_base ? 'FLAT' : read.direction,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const started = new Date();
  const log = (m, x = undefined) => console.log(`[xEngagement ${started.toISOString()}] ${m}`, x ?? '');

  try {
    // Secrets guard
    const missing = ['X_BEARER_TOKEN', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'DISCORD_WEBHOOK_URL']
      .filter((s) => !Deno.env.get(s));
    if (missing.length) {
      return Response.json({ error: `Missing secrets: ${missing.join(', ')}` }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const live = await loadLive(base44);
    const body = await req.json().catch(() => ({}));
    const asset = (body?.asset || '').toString().toUpperCase().trim();

    // --- Direct real-signal mode: fetch live data for a given asset, run the
    //     probability read, and post it to Discord.
    //     No X dependency — fires on demand (e.g. scheduled or manual trigger). ---
    if (asset) {
      const ticker = asset;
      const tr = await readTicker(ticker, live);
      if (!tr) {
        return Response.json({ ok: false, error: 'insufficient_market_data', ticker });
      }
      const stats = statsOf(tr.read);
      const stateBlock = probabilityBlock(tr.read, `${ticker} daily`);
      const statsLine = probabilityLine(tr.read, ticker);

      const composed = await base44.integrations.Core.InvokeLLM({
        prompt: `${IDENTITY_LINE} Compose a market note for the Discord #signals channel based ENTIRELY on the HEX6-BLE engine's probability read below.

${CONFIDENTIALITY_LINE}

ASSET: ${ticker}
LAST CLOSE: ${tr.latestPrice != null ? '$' + tr.latestPrice.toFixed(2) : 'n/a'} (${tr.bars} daily bars)

${stateBlock}

Produce JSON:
1. "discord_elaboration": <=1800 chars, markdown ok, for the #signals channel. State both probabilities beside their usual odds and say what each means for prediction-market contracts on this asset (direction contracts and range contracts). If a number sits at its usual odds, say there is no edge there. State no other figure, forecast or claim about flows, sentiment or the wider market — nothing that is not in the block above. Do not disclose proprietary internals.`,
        model: CLAUDE_MODEL,
        response_json_schema: {
          type: 'object',
          properties: { discord_elaboration: { type: 'string' } },
          required: ['discord_elaboration'],
        },
      }).catch(() => null);

      const discordElab = composed?.discord_elaboration || '';
      const discordBody = `**HEX [PI] · probability read — ${ticker}**\n\n${discordElab}\n\n${statsLine}\n\n📥 Join the HEX [PI] community: https://discord.gg/KuPKVmYkD`;
      let discordPosted = false;
      discordPosted = await postDiscord(discordBody);

      return Response.json({ ok: true, ticker, posted_to_discord: discordPosted, stats, points: tr.bars });
    }

    // 1. Search X across all niche categories — pool candidates so no single
    //    high-volume category buries niche alpha.
    const seenTweetIds = new Set();
    const allCandidates = [];
    const usernameById = {};
    for (const cat of SEARCH_CATEGORIES) {
      let search;
      try {
        search = await xSearchRecent(cat.query, MAX_RESULTS);
      } catch (e) {
        log(`search failed for ${cat.name}`, e?.message);
        continue;
      }
      const tweets = Array.isArray(search?.data) ? search.data : [];
      const users = Array.isArray(search?.includes?.users) ? search.includes.users : [];
      for (const u of users) usernameById[u.id] = u.username;
      for (const t of tweets) {
        if (seenTweetIds.has(t.id)) continue;
        seenTweetIds.add(t.id);
        const m = t.public_metrics || {};
        const engagement = (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0);
        allCandidates.push({ tweet: t, engagement, category: cat.name });
      }
      log(`category ${cat.name}: ${tweets.length} tweets`);
    }

    if (allCandidates.length === 0) {
      log('no tweets returned across categories');
      return Response.json({ ok: true, processed: 0, reason: 'no_tweets' });
    }

    // 2. Rank by total engagement and filter to actionable candidates.
    const ranked = allCandidates
      .filter((x) => x.engagement >= ENGAGEMENT_FLOOR)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, TOP_N * 3); // pool a little wider than TOP_N for skips

    log(`ranked pool: ${ranked.length} candidates (from ${allCandidates.length} across ${SEARCH_CATEGORIES.length} categories)`);

    let processed = 0;
    let posted = 0;

    for (const { tweet } of ranked) {
      if (processed >= TOP_N) break;
      const tweetId = tweet.id;
      const author = usernameById[tweet.author_id] || 'unknown';
      const text = (tweet.text || '').slice(0, 280);

      // 3. Dedup — skip tweets we've already engaged.
      try {
        const existing = await base44.asServiceRole.entities.XEngagement.filter({ tweet_id: tweetId });
        if (existing && existing.length > 0) {
          log(`skip already-engaged ${tweetId}`);
          continue;
        }
      } catch (e) { log(`dedup check failed (non-blocking) ${tweetId}`, e?.message); }

      processed++;

      // 4. Triage — extract ticker + claim.
      let triage;
      try {
        triage = await base44.integrations.Core.InvokeLLM({
          prompt: `Extract the market claim from this X post. Identify the single most relevant tradeable asset (ticker) and the directional/valuation claim being made or implied.\n\nTWEET by @${author}:\n"${text}"\n\nReturn JSON { ticker: uppercase string or "UNKNOWN", claim: one-sentence plain summary, actionable: boolean (true only if the tweet makes or implies a directional market claim about a specific, exchange-listed asset) }.`,
          model: CLAUDE_MODEL,
          response_json_schema: {
            type: 'object',
            properties: {
              ticker: { type: 'string' },
              claim: { type: 'string' },
              actionable: { type: 'boolean' },
            },
            required: ['ticker', 'claim', 'actionable'],
          },
        });
      } catch (e) {
        log(`triage failed ${tweetId}`, e?.message);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          status: 'failed', error: `triage: ${e?.message || ''}`.slice(0, 1000),
        }).catch(() => {});
        continue;
      }

      const ticker = (triage?.ticker || 'UNKNOWN').toUpperCase();
      const claim = (triage?.claim || '').slice(0, 500);
      const actionable = !!triage?.actionable;

      if (!actionable || ticker === 'UNKNOWN') {
        log(`skip non-actionable ${tweetId} ticker=${ticker}`);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          ticker, claim, actionable, status: 'skipped', skip_reason: 'not_actionable',
        }).catch(() => {});
        continue;
      }

      // 5–6. Real daily bars for the ticker, then the calibrated read.
      const tr = await readTicker(ticker, live);
      if (!tr) {
        log(`skip no-data ${tweetId}`);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          ticker, claim, actionable, status: 'skipped', skip_reason: 'insufficient_market_data',
        }).catch(() => {});
        continue;
      }
      const stats = statsOf(tr.read);
      const stateBlock = probabilityBlock(tr.read, `${ticker} daily`);

      // 7. Compose the X reply and the Discord note in one LLM call.
      const statsLine = probabilityLine(tr.read, ticker);

      let composed;
      try {
        composed = await base44.integrations.Core.InvokeLLM({
          prompt: `${IDENTITY_LINE} You are replying to a widely shared X post with the probability read the HEX6-BLE engine computed on the asset it names.

${CONFIDENTIALITY_LINE}

ORIGINAL TWEET by @${author}:
"${text}"

EXTRACTED CLAIM: ${claim}
ASSET: ${ticker}

LAST CLOSE: ${tr.latestPrice != null ? '$' + tr.latestPrice.toFixed(2) : 'n/a'} (${tr.bars} daily bars)

${stateBlock}

Produce JSON with two fields:
1. "x_reply": a single X reply, <=270 characters. Conversational, professional, no emojis, no mention of being a bot, no fabricated links. Give the one probability most relevant to the claim, beside its usual odds. If it sits at its usual odds, say the data shows no lean either way. Never say the claim is right or wrong, never call the read validated, and never state a confidence. Speak to the claim in the tweet.
2. "discord_elaboration": a fuller explanation, <=1800 characters, for the Discord #signals channel. Markdown ok. State both probabilities beside their usual odds and say what each means for prediction-market contracts on this asset. If a number sits at its usual odds, say there is no edge there. State no other figure, forecast or claim about flows, sentiment or the wider market — nothing that is not in the block above. Do not disclose proprietary internals.`,
          model: CLAUDE_MODEL,
          response_json_schema: {
            type: 'object',
            properties: {
              x_reply: { type: 'string' },
              discord_elaboration: { type: 'string' },
            },
            required: ['x_reply', 'discord_elaboration'],
          },
        });
      } catch (e) {
        log(`compose failed ${tweetId}`, e?.message);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          ticker, claim, actionable,
          ...stats,
          status: 'failed', error: `compose: ${e?.message || ''}`.slice(0, 1000),
        }).catch(() => {});
        continue;
      }

      const xReply = (composed?.x_reply || '').slice(0, 270);
      const discordElab = composed?.discord_elaboration || '';

      if (!xReply) {
        log(`skip empty reply ${tweetId}`);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          ticker, claim, actionable,
          ...stats,
          status: 'skipped', skip_reason: 'empty_reply',
        }).catch(() => {});
        continue;
      }

      // 8. Post the X reply.
      let replyTweetId = null;
      try {
        replyTweetId = await xPostReply(xReply, tweetId);
      } catch (e) {
        log(`X post failed ${tweetId}`, e?.message);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          ticker, claim, actionable, x_reply_text: xReply,
          ...stats,
          status: 'failed', error: `x_post: ${e?.message || ''}`.slice(0, 1000),
        }).catch(() => {});
        continue;
      }

      // 9. Post the fuller note to Discord.
      let discordPosted = false;
      const discordBody = `**HEX [PI] · probability read — @${author} on ${ticker}**\n> ${text.replace(/\n/g, ' ')}\n\n${discordElab}\n\n${statsLine}\n\n📥 Join the HEX [PI] community: https://discord.gg/KuPKVmYkD`;
      discordPosted = await postDiscord(discordBody);
      if (!discordPosted) log(`Discord post failed ${tweetId}`);

      // 10. Record.
      await base44.asServiceRole.entities.XEngagement.create({
        tweet_id: tweetId, author_username: author, text_snippet: text,
        ticker, claim, actionable,
        reply_tweet_id: replyTweetId, x_reply_text: xReply,
        discord_posted: discordPosted, discord_elaboration: discordElab,
          ...stats,
        status: 'posted',
      }).catch(() => {});

      posted++;
      // Gentle pacing between posts.
      await new Promise((r) => setTimeout(r, 2500));
    }

    log(`done processed=${processed} posted=${posted}`);
    return Response.json({ ok: true, processed, posted, candidates: ranked.length });
  } catch (error) {
    console.error('xEngagement ERROR:', error);
    return Response.json({ error: error?.message || 'xEngagement failed' }, { status: 500 });
  }
});