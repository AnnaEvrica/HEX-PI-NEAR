// HEX6-BLE / PI-US → X (Twitter) + Discord engagement pipeline.
// Scheduled automation: searches X for high-engagement crypto/market tweets,
// validates each claim through the HEX6 thinking engine, posts a sniper-precise
// reply on X, and elaborates the full reasoning + best stats in Discord.
//
// Service-role (no user) — matches the app's existing scheduled-function pattern.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  runReasonLayer, runWaveLayer, runValidationLayer, buildThinkingState,
  renderThinkingState,
} from '../../shared/thinkingEngine.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SEARCH_QUERY = '(BTC OR ETH OR bitcoin OR ethereum OR crypto OR cryptocurrency OR SPY OR "S&P 500") -is:retweet -is:reply lang:en';
const MAX_RESULTS = 100;            // recent-search cap
const ENGAGEMENT_FLOOR = 800;       // min (likes + retweets + replies + quotes) to consider
const TOP_N = 3;                     // tweets processed per run
const RISK_AVERSION = 2.5;
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

async function discordPost(content) {
  const webhook = Deno.env.get('DISCORD_WEBHOOK_URL');
  // Discord message cap is 2000 chars; truncate gracefully.
  const body = content.length > 1950 ? content.slice(0, 1940) + '\n…(truncated)' : content;
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: body }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Discord ${res.status}: ${t}`);
  }
}

// Convert raw price levels → percent returns (matches think/entry.ts toReturns).
function toReturns(series) {
  if (!Array.isArray(series) || series.length < 2) return series;
  const allPos = series.every((v) => v > 0);
  const level = Math.min(...series);
  if (allPos && level > 1) {
    const out = [];
    for (let i = 1; i < series.length; i++) {
      if (series[i - 1] !== 0) out.push((series[i] - series[i - 1]) / series[i - 1]);
    }
    return out;
  }
  return series;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const started = new Date();
  const log = (m, x) => console.log(`[xEngagement ${started.toISOString()}] ${m}`, x ?? '');

  try {
    // Secrets guard
    const missing = ['X_BEARER_TOKEN', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'DISCORD_WEBHOOK_URL']
      .filter((s) => !Deno.env.get(s));
    if (missing.length) {
      return Response.json({ error: `Missing secrets: ${missing.join(', ')}` }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);

    // 1. Search X for high-engagement crypto/market tweets.
    const search = await xSearchRecent(SEARCH_QUERY, MAX_RESULTS);
    const tweets = Array.isArray(search?.data) ? search.data : [];
    const users = Array.isArray(search?.includes?.users) ? search.includes.users : [];
    const usernameById = {};
    for (const u of users) usernameById[u.id] = u.username;

    if (tweets.length === 0) {
      log('no tweets returned');
      return Response.json({ ok: true, processed: 0, reason: 'no_tweets' });
    }

    // 2. Rank by total engagement and filter to actionable candidates.
    const ranked = tweets
      .map((t) => {
        const m = t.public_metrics || {};
        const engagement = (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0);
        return { tweet: t, engagement };
      })
      .filter((x) => x.engagement >= ENGAGEMENT_FLOOR)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, TOP_N * 3); // pool a little wider than TOP_N for skips

    log(`ranked pool: ${ranked.length} candidates`);

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
          prompt: `Extract the market claim from this X post. Identify the single most relevant tradeable asset (ticker) and the directional/valuation claim being made or implied.\n\nTWEET by @${author}:\n"${text}"\n\nReturn JSON { ticker: uppercase string or "UNKNOWN", claim: one-sentence plain summary, actionable: boolean (true only if the tweet makes or implies a HEX6-validatable directional market claim about a specific asset) }.`,
          model: 'gemini_3_flash',
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

      // 5. Fetch live market data for the ticker (web-grounded).
      let fetchResult = null;
      try {
        fetchResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a data retrieval step for HEX6-BLE. Pull the latest price history for ${ticker} from authoritative sources (Yahoo Finance, CoinGecko, etc.). Return at least 30 recent daily closes as a series.\n\nReturn JSON: factual_summary (neutral context, no conclusions), needs_engine (boolean), ticker (string), series (array of >=30 numbers — daily closes), as_returns (boolean, false since these are prices), source_summary (one sentence), sources (array of {name,url} you actually retrieved).`,
          model: 'gemini_3_flash',
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              factual_summary: { type: 'string' },
              needs_engine: { type: 'boolean' },
              ticker: { type: 'string' },
              series: { type: 'array', items: { type: 'number' } },
              as_returns: { type: 'boolean' },
              source_summary: { type: 'string' },
              sources: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } } } },
            },
            required: ['factual_summary'],
          },
        });
      } catch (e) { log(`fetch failed ${tweetId}`, e?.message); }

      const rawSeries = Array.isArray(fetchResult?.series) ? fetchResult.series : [];
      // Normalize through toReturns unconditionally: it converts price levels
      // (all positive, magnitude > 1) to percent returns and leaves genuine
      // return series intact (mixed sign or magnitude < 1). Safer than trusting
      // the LLM's as_returns flag, which can be omitted.
      const returns = toReturns(rawSeries);

      // 6. Run the HEX6-BLE / PI-US engine.
      let stateBlock = '';
      let stats = null;
      let ranEngine = false;
      if (returns.length >= 30) {
        const reason = runReasonLayer(returns, RISK_AVERSION, 0.0035, 6, null, null);
        const wave = runWaveLayer(returns);
        const validation = runValidationLayer(reason, wave);
        const thinkingState = buildThinkingState(reason, wave, validation, true, returns);
        stateBlock = renderThinkingState(thinkingState);
        stats = {
          probability: validation.probability,
          resonance: validation.resonance,
          value: validation.support,
          confidence: validation.confidence,
          direction: validation.identifiedDirection,
          forward_accuracy: thinkingState?.forward?.directionalAccuracy ?? null,
        };
        ranEngine = true;
      }

      // Only post replies backed by a validated engine read.
      if (!ranEngine) {
        log(`skip no-engine ${tweetId}`);
        await base44.asServiceRole.entities.XEngagement.create({
          tweet_id: tweetId, author_username: author, text_snippet: text,
          ticker, claim, actionable, status: 'skipped', skip_reason: 'insufficient_market_data',
        }).catch(() => {});
        continue;
      }

      // 7. Compose sniper X reply + Discord elaboration in one LLM call (credit-efficient).
      const statsLine = `Probability ${(stats.probability*100).toFixed(0)}% · Resonance ${(stats.resonance*100).toFixed(0)}% · Support ${(stats.value*100).toFixed(0)}% · Confidence ${(stats.confidence*100).toFixed(0)}% · Direction ${stats.direction}` + (stats.forward_accuracy != null ? ` · Forward accuracy ${(stats.forward_accuracy*100).toFixed(0)}%` : '');

      let composed;
      try {
        composed = await base44.integrations.Core.InvokeLLM({
          prompt: `You are PI-US by Evrica Technologies Inc. You are replying to a viral X post with a sniper-precise, validated market truth computed by HEX6-BLE.

PROPRIETARY CONFIDENTIALITY: HEX6-BLE and PI-US are proprietary technology of Evrica Technologies Inc. Never disclose internals — Reasoning/Understanding operators, Core/thinking/learning architecture, mycelium-based chips, or predictive encryption. Share only high-level structural concepts (structural probability fused with wave resonance to reach a support-gated conclusion).

ORIGINAL TWEET by @${author}:
"${text}"

EXTRACTED CLAIM: ${claim}
ASSET: ${ticker}

THINKING STATE (the computed truth — base your reply ENTIRELY on this; do not invent):
${stateBlock}

DATA SNAPSHOT: ${fetchResult?.factual_summary || 'No external data retrieved.'}

STATS: ${statsLine}

Produce JSON with two fields:
1. "x_reply": a single X reply, <=270 characters. Conversational, professional, no emojis, no mention of being a bot, no fabricated links. State the validated truth plainly, calibrated to the support/confidence — do not hedge when support is high; acknowledge thin support honestly when it is low. Speak to the claim in the tweet.
2. "discord_elaboration": a fuller explanation, <=1800 characters, for Discord. Markdown ok. Include the STATS line explicitly, explain the reasoning in plain terms, state the decision, and give one alternative. Do not disclose proprietary internals.`,
          model: 'gemini_3_flash',
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
          probability: stats.probability, resonance: stats.resonance, value: stats.value,
          confidence: stats.confidence, predicted_direction: stats.direction,
          forward_accuracy: stats.forward_accuracy,
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
          probability: stats.probability, resonance: stats.resonance, value: stats.value,
          confidence: stats.confidence, predicted_direction: stats.direction,
          forward_accuracy: stats.forward_accuracy,
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
          probability: stats.probability, resonance: stats.resonance, value: stats.value,
          confidence: stats.confidence, predicted_direction: stats.direction,
          forward_accuracy: stats.forward_accuracy,
          status: 'failed', error: `x_post: ${e?.message || ''}`.slice(0, 1000),
        }).catch(() => {});
        continue;
      }

      // 9. Post the Discord elaboration.
      let discordPosted = false;
      const discordBody = `**HEX6-BLE · validated reply to @${author} on ${ticker}**\n> ${text.replace(/\n/g, ' ')}\n\n${discordElab}\n\n${statsLine}`;
      try {
        await discordPost(discordBody);
        discordPosted = true;
      } catch (e) { log(`Discord post failed ${tweetId}`, e?.message); }

      // 10. Record.
      await base44.asServiceRole.entities.XEngagement.create({
        tweet_id: tweetId, author_username: author, text_snippet: text,
        ticker, claim, actionable,
        reply_tweet_id: replyTweetId, x_reply_text: xReply,
        discord_posted: discordPosted, discord_elaboration: discordElab,
        probability: stats.probability, resonance: stats.resonance, value: stats.value,
        confidence: stats.confidence, predicted_direction: stats.direction,
        forward_accuracy: stats.forward_accuracy,
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