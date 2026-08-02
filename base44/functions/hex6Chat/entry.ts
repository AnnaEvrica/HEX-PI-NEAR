import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ---------------------------------------------------------------------------
// HEX6 BLE Engine — inlined SCEFM math (no import overhead)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HEX6 BLE v5.1 — SCEFM with Decay-Weighted HIVE + Cross-Asset Correlation Bit
// State space: 2^7 = 128 per asset (6 momentum bits + 1 correlation bit)
// Decay: exponential weighting λ=0.94 — recent observations dominate
// ---------------------------------------------------------------------------

function normalPpf(p) {
  const a = [-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239];
  const b = [-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1];
  const c = [-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d = [7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    const q = p - 0.5, r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

function tPpf(p, df) {
  if (df >= 30) return normalPpf(p);
  const a = 1/(df-0.5), b = 48/(a*a);
  const c = ((20700*a/b-98)*a-16)*a+96.36;
  const dd = ((94.5/(b+c)-3)/b+1)*Math.sqrt(a*Math.PI/2)*df;
  let x = dd * normalPpf(p);
  const x2 = x*x;
  if (x2 > 0.5*df+0.2) x = Math.pow(2*df*(1-(1-a)*x2/(df+1/x2))-df, 0.5);
  return x;
}

// Pearson correlation between two equal-length arrays
function pearsonCorr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const mb = b.slice(0, n).reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] - ma, bi = b[i] - mb;
    num += ai * bi; da += ai * ai; db += bi * bi;
  }
  return (da === 0 || db === 0) ? 0 : num / Math.sqrt(da * db);
}

// Adaptive decay factor — λ scales with series length so half-life is meaningful
// Short series → less aggressive decay (more weight on full window)
// Long series → tighter decay (recent observations dominate)
function adaptiveLambda(seriesLength) {
  if (seriesLength < 30) return 0.97;   // half-life ≈ 23
  if (seriesLength < 80) return 0.95;   // half-life ≈ 14
  if (seriesLength < 200) return 0.94;  // half-life ≈ 12
  if (seriesLength < 500) return 0.92;  // half-life ≈ 9
  return 0.90;                           // half-life ≈ 7
}

// Decay-weighted mean and variance
// Each observation at index i (0=oldest, T-1=newest) gets weight λ^(T-1-i)
function decayStats(observations, lambda = 0.94) {
  const T = observations.length;
  let wSum = 0, wMean = 0, wVar = 0;
  const weights = observations.map((_, i) => Math.pow(lambda, T - 1 - i));
  wSum = weights.reduce((s, w) => s + w, 0);
  wMean = observations.reduce((s, x, i) => s + weights[i] * x, 0) / wSum;
  wVar = observations.reduce((s, x, i) => s + weights[i] * (x - wMean) ** 2, 0) / wSum;
  // Effective sample size for t-distribution df
  const w2Sum = weights.reduce((s, w) => s + w * w, 0);
  const nEff = Math.max(2, Math.round((wSum * wSum) / w2Sum));
  return { mu: wMean, sigma: Math.sqrt(wVar), nEff };
}

// ---------------------------------------------------------------------------
// Markov 64-state transition layer — captures regime momentum
// Encodes 6-bit momentum patterns (2^6 = 64 states), tracks state-to-state transitions
// Returns expected next-step return based on transition probabilities
// ---------------------------------------------------------------------------
function encodeState6(slice) {
  if (slice.length < 6) return null;
  const bits = slice.slice(-6).map(r => r > 0 ? '1' : '0').join('');
  return parseInt(bits, 2);
}

// Markov edge — optionally accepts a persistent prior {transitionCounts, transitionStats}
// transitionStats = { "s0->s1": { sum, sum2, n } } from prior history (other tickers' brain)
function markovEdge(returns, priorCounts = null, priorStats = null) {
  if (returns.length < 8) return { mu: 0, sigma: 0, n: 0, transitionConfidence: 0, currentState: null, freshTransitions: {}, freshStats: {} };

  // Build transition counts and per-transition reward stats from current series
  const freshCounts = {};
  const freshStats = {}; // "s0->s1" -> { sum, sum2, n }

  for (let i = 6; i < returns.length - 1; i++) {
    const s0 = encodeState6(returns.slice(i - 6, i));
    const s1 = encodeState6(returns.slice(i - 5, i + 1));
    if (s0 === null || s1 === null) continue;
    const key = `${s0}->${s1}`;
    freshCounts[key] = (freshCounts[key] || 0) + 1;
    if (!freshStats[key]) freshStats[key] = { sum: 0, sum2: 0, n: 0 };
    const r = returns[i + 1];
    freshStats[key].sum += r;
    freshStats[key].sum2 += r * r;
    freshStats[key].n += 1;
  }

  // Merge with prior (persistent brain)
  const mergedCounts = { ...(priorCounts || {}) };
  const mergedStats = {};
  for (const k in (priorStats || {})) {
    mergedStats[k] = { ...priorStats[k] };
  }
  for (const k in freshCounts) {
    mergedCounts[k] = (mergedCounts[k] || 0) + freshCounts[k];
    if (!mergedStats[k]) mergedStats[k] = { sum: 0, sum2: 0, n: 0 };
    mergedStats[k].sum += freshStats[k].sum;
    mergedStats[k].sum2 += freshStats[k].sum2;
    mergedStats[k].n += freshStats[k].n;
  }

  const currentState = encodeState6(returns.slice(-6));
  if (currentState === null) return { mu: 0, sigma: 0, n: 0, transitionConfidence: 0, currentState: null, freshTransitions: freshCounts, freshStats };

  // Aggregate edge across all transitions FROM currentState (using merged data)
  let totalCount = 0;
  const transitions = [];
  for (const key in mergedCounts) {
    if (key.startsWith(`${currentState}->`)) {
      totalCount += mergedCounts[key];
      transitions.push({ key, count: mergedCounts[key], stats: mergedStats[key] });
    }
  }

  if (totalCount === 0) return { mu: 0, sigma: 0, n: 0, transitionConfidence: 0, currentState, freshTransitions: freshCounts, freshStats };

  // Probability-weighted expected return
  let mu = 0, secondMoment = 0;
  for (const t of transitions) {
    const prob = t.count / totalCount;
    const meanR = t.stats.n > 0 ? t.stats.sum / t.stats.n : 0;
    const meanR2 = t.stats.n > 0 ? t.stats.sum2 / t.stats.n : 0;
    mu += prob * meanR;
    secondMoment += prob * meanR2;
  }
  const sigma = Math.sqrt(Math.max(0, secondMoment - mu * mu));
  const transitionConfidence = Math.min(1, totalCount / 30);

  return { mu, sigma, n: totalCount, transitionConfidence, currentState, freshTransitions: freshCounts, freshStats };
}

// ---------------------------------------------------------------------------
// Adaptive 1/137 motif tracking — flags rare prime-number states as edge signal
// Tracks if motif states (1,3,7,13,17,31,37) systematically outperform other states
// Returns a tanh-bounded score in [-1, 1]
// ---------------------------------------------------------------------------
const MOTIF_STATES = new Set([1, 3, 7, 13, 17, 31, 37]);

function adaptive137Score(returns) {
  if (returns.length < 8) return { score: 0, motifMu: 0, elseMu: 0, isMotifNow: false };

  let motifSum = 0, motifSum2 = 0, motifN = 0;
  let elseSum = 0, elseSum2 = 0, elseN = 0;

  for (let i = 6; i < returns.length; i++) {
    const state = encodeState6(returns.slice(i - 6, i));
    if (state === null) continue;
    const r = returns[i];
    if (MOTIF_STATES.has(state)) {
      motifSum += r; motifSum2 += r * r; motifN++;
    } else {
      elseSum += r; elseSum2 += r * r; elseN++;
    }
  }

  const motifMu = motifN > 0 ? motifSum / motifN : 0;
  const elseMu = elseN > 0 ? elseSum / elseN : 0;
  const motifVar = motifN > 0 ? Math.max(1e-8, motifSum2 / motifN - motifMu * motifMu) : 1e-4;
  const denom = Math.sqrt(motifVar);

  const currentState = encodeState6(returns.slice(-6));
  const isMotifNow = currentState !== null && MOTIF_STATES.has(currentState);

  // Only emit signal when current state IS a motif state
  if (!isMotifNow || motifN < 3) return { score: 0, motifMu, elseMu, isMotifNow };

  const relative = (motifMu - elseMu) / denom;
  const score = Math.tanh(relative);
  return { score, motifMu, elseMu, isMotifNow };
}

// ---------------------------------------------------------------------------
// I-Ching Petal Unfolding — 128 states bloom into TWO 64-petal hexagrams
// Yang petals (corrBit=1, trend-aligned/coherent) — heaven hexagram half
// Yin petals (corrBit=0, divergent/incoherent) — earth hexagram half
// Each petal = one of 64 hexagram numbers; petal index = momentum 6-bit pattern
// ---------------------------------------------------------------------------
const HEXAGRAM_NAMES = [
  'Earth', 'Returning', 'Approach', 'Peace', 'Receptive Power', 'Modesty', 'Pushing Upward', 'Army',
  'Splitting Apart', 'Gentle Wind', 'Stagnation', 'Heaven Below', 'Receptive Light', 'Wandering', 'Inner Truth', 'Limitation',
  'Influence', 'Decrease', 'Increase', 'Sun', 'Brightness', 'Family', 'Revolution', 'Abysmal Water',
  'Joyous Lake', 'Marrying Maiden', 'Difficulty', 'Following', 'Work on Decay', 'Biting Through', 'Treading', 'Holding Together',
  'Conflict', 'Retreat', 'Standstill', 'Oppression', 'Withdrawal', 'Obstruction', 'Estrangement', 'After Completion',
  'Coming to Meet', 'Cauldron', 'Well', 'Innocence', 'Fellowship', 'Possession in Great Measure', 'Enthusiasm', 'Caring',
  'Great Power', 'Vigor', 'Eminence', 'Liberation', 'Adornment', 'Receptive Stillness', 'Development', 'Abundance',
  'Coming Together', 'Receptive Joy', 'Penetrating', 'Pure Yang', 'Firmness', 'Creative Power', 'Heaven', 'Creative'
];

// Compute a sub-petal signature from local mu/sigma — bounded resolution but unlimited depth slots
// Each petal (0-63) holds an unbounded dictionary of sub-resonances keyed by harmonic signature
// Frame stays 64; unfolding within is infinite
function subPetalSignature(mu, sigma) {
  // Quantize mu into signed harmonic bands (32 bands), sigma into volatility octaves (8 octaves)
  // Combined key gives 256 possible sub-resonance slots per petal — but a petal can grow new ones forever
  // as new mu/sigma combinations appear. The signature itself is a fingerprint, not a bounded index.
  const muBand = Math.max(-16, Math.min(15, Math.round(mu * 1000))); // ~0.001 resolution
  const sigOctave = sigma <= 0 ? 0 : Math.max(0, Math.min(15, Math.round(Math.log2(sigma * 1000 + 1))));
  return `m${muBand}_s${sigOctave}`;
}

function classifyPetal(stateKey7, mu = 0, sigma = 0) {
  if (stateKey7 === null || stateKey7 === undefined) return null;
  const corrBit = stateKey7 & 1;
  const petalIndex = stateKey7 >> 1; // 6-bit momentum = petal 0-63 (frame is bounded)
  const polarity = corrBit === 1 ? 'yang' : 'yin';
  const hexagramName = HEXAGRAM_NAMES[petalIndex] || `Petal ${petalIndex}`;
  const subSignature = subPetalSignature(mu, sigma); // unbounded sub-unfolding within the petal
  return {
    polarity,
    petalIndex,
    hexagramName,
    subSignature,
    polarityFull: corrBit === 1 ? 'yang (coherent / heaven half)' : 'yin (divergent / earth half)',
  };
}

// ---------------------------------------------------------------------------
// Archetype basin classification — names the regime instead of raw bits
// ---------------------------------------------------------------------------
function classifyBasin(stateKey6, mu, sigma) {
  if (stateKey6 === null || stateKey6 === undefined) return 'undefined';
  if (stateKey6 === 0) return 'capitulation';
  if (stateKey6 === 63) return 'euphoria';
  if (mu > 0 && sigma < 0.01) return 'laminar_growth';
  if (mu < 0 && sigma > 0.02) return 'turbulent_drawdown';
  if (sigma > 0.025) return 'chaotic_transition';
  return 'neutral_flow';
}

// ---------------------------------------------------------------------------
// Core engine — accepts optional reference series for cross-asset corr bit
// ---------------------------------------------------------------------------
function runHex6Engine(returns, riskAversion = 2.5, friction = 0.0035, windowSize = 6, refReturns = null, priorMarkov = null) {
  const LAMBDA = adaptiveLambda(returns.length); // adaptive decay based on series length

  // Build decay-weighted HIVE
  // key = 7-bit integer: bits 6..1 = momentum pattern, bit 0 = correlation regime
  const hive = {}; // key → [{value, weight}]

  for (let i = windowSize; i < returns.length; i++) {
    const slice = returns.slice(i - windowSize, i);

    // Bits 6..1: momentum pattern (same as v5.0)
    const momentumBits = parseInt(slice.map(r => r > 0 ? '1' : '0').join(''), 2);

    // Bit 0: correlation regime — is this asset moving WITH a reference?
    // If no ref series, compute rolling self-correlation (trend consistency)
    let corrBit = 0;
    if (refReturns && refReturns.length >= i) {
      const corrWindow = Math.min(windowSize * 2, i);
      const corr = pearsonCorr(
        returns.slice(i - corrWindow, i),
        refReturns.slice(i - corrWindow, i)
      );
      corrBit = corr > 0.4 ? 1 : 0; // high positive correlation = 1
    } else {
      // Self-correlation: are the last 12 returns directionally consistent?
      const longWindow = Math.min(12, i);
      const longSlice = returns.slice(i - longWindow, i);
      const posCount = longSlice.filter(r => r > 0).length;
      corrBit = posCount / longWindow > 0.6 ? 1 : 0; // trend consistency bit
    }

    // 7-bit key: shift momentum bits left by 1, OR in corrBit
    const key = (momentumBits << 1) | corrBit;

    // Decay weight: age = distance from end of series
    const age = returns.length - 1 - i;
    const weight = Math.pow(LAMBDA, age);

    if (!hive[key]) hive[key] = [];
    hive[key].push({ value: returns[i], weight });
  }

  // Current 7-bit state
  const recentSlice = returns.slice(-windowSize);
  const momentumKey = parseInt(recentSlice.map(r => r > 0 ? '1' : '0').join(''), 2);

  let currentCorrBit = 0;
  if (refReturns && refReturns.length >= windowSize * 2) {
    const corr = pearsonCorr(returns.slice(-windowSize * 2), refReturns.slice(-windowSize * 2));
    currentCorrBit = corr > 0.4 ? 1 : 0;
  } else {
    const longSlice = returns.slice(-12);
    const posCount = longSlice.filter(r => r > 0).length;
    currentCorrBit = posCount / longSlice.length > 0.6 ? 1 : 0;
  }

  const stateKey = (momentumKey << 1) | currentCorrBit;
  const stateBits = stateKey.toString(2).padStart(7, '0');
  const bin = hive[stateKey] || [];

  if (bin.length < 3) {
    return {
      mu: 0, sigma: 0, exposure: 0, blendedExposure: 0,
      stateKey, stateBits, n: bin.length,
      nEff: 0, corrBit: currentCorrBit,
      regime: 'INSUFFICIENT_DATA',
      basin: 'undefined',
      petal: classifyPetal(stateKey, 0, 0),
      lambda: LAMBDA,
      markov: { mu: 0, sigma: 0, n: 0, confidence: 0, freshTransitions: {}, freshStats: {} },
      motif: { score: 0, isActive: false, motifMu: 0, elseMu: 0 },
      engineVersion: 'SCEFM-v5.3-IChing128+Markov64persistent+1/137+Basin+AdaptiveDecay'
    };
  }

  // Decay-weighted statistics
  const values = bin.map(o => o.value);
  const weights = bin.map(o => o.weight);
  const wSum = weights.reduce((s, w) => s + w, 0);
  const mu = values.reduce((s, x, i) => s + weights[i] * x, 0) / wSum;
  const variance = values.reduce((s, x, i) => s + weights[i] * (x - mu) ** 2, 0) / wSum;
  const sigma = Math.sqrt(variance);
  const w2Sum = weights.reduce((s, w) => s + w * w, 0);
  const nEff = Math.max(2, Math.round((wSum * wSum) / w2Sum));

  const tCrit = tPpf(0.95, nEff - 1);
  const muLb = mu - tCrit * (sigma / Math.sqrt(nEff)) - friction;

  let exposure = 0;
  if (muLb > 0) {
    exposure = Math.min(Math.max((muLb / sigma ** 2) / riskAversion, 0), 1);
  }

  const regime = exposure > 0.6 ? 'BULL' : exposure > 0.3 ? 'LATERAL' : mu < 0 ? 'BEAR' : 'SILENCE';

  // ---- Additive layers: Markov (with persistent prior) + 1/137 motif + Basin + Petal ----
  const markov = markovEdge(returns, priorMarkov?.counts || null, priorMarkov?.stats || null);
  const motif = adaptive137Score(returns);
  const basin = classifyBasin(markov.currentState, mu, sigma);
  const petal = classifyPetal(stateKey, mu, sigma);
  if (petal) { petal.mu = mu; petal.sigma = sigma; }

  // Blended exposure: original SCEFM + Markov edge boost + 1/137 motif boost
  // 70% SCEFM core, 20% Markov forward-looking, 10% motif signal
  let blendedExposure = exposure;
  if (markov.transitionConfidence > 0.3 && markov.sigma > 0) {
    const markovExposure = Math.min(Math.max((markov.mu / (markov.sigma * markov.sigma)) / riskAversion, 0), 1);
    blendedExposure = 0.7 * exposure + 0.2 * markovExposure + 0.1 * Math.max(0, motif.score);
    blendedExposure = Math.min(Math.max(blendedExposure, 0), 1);
  }

  return {
    mu: parseFloat(mu.toFixed(6)),
    sigma: parseFloat(sigma.toFixed(6)),
    exposure: parseFloat(exposure.toFixed(4)),
    blendedExposure: parseFloat(blendedExposure.toFixed(4)),
    stateKey, stateBits,
    n: bin.length,
    nEff,
    corrBit: currentCorrBit,
    regime,
    basin,
    petal,
    lambda: LAMBDA,
    markov: {
      mu: parseFloat(markov.mu.toFixed(6)),
      sigma: parseFloat(markov.sigma.toFixed(6)),
      n: markov.n,
      confidence: parseFloat(markov.transitionConfidence.toFixed(3)),
      freshTransitions: markov.freshTransitions,
      freshStats: markov.freshStats,
    },
    motif: {
      score: parseFloat(motif.score.toFixed(4)),
      isActive: motif.isMotifNow,
      motifMu: parseFloat(motif.motifMu.toFixed(6)),
      elseMu: parseFloat(motif.elseMu.toFixed(6)),
    },
    engineVersion: 'SCEFM-v5.3-IChing128+Markov64persistent+1/137+Basin+AdaptiveDecay'
  };
}

// ---------------------------------------------------------------------------
// Detect if message contains a numerical data series
// ---------------------------------------------------------------------------
function extractNumberSeries(text) {
  // Match comma/space/newline separated numbers (integers or decimals, including negatives)
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length < 7) return null; // need at least 7 for window=6
  return matches.map(Number);
}

// Map a user-facing ticker to the Yahoo Finance symbol the marketData function expects.
function toYahooSymbol(ticker) {
  const crypto = { BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', DOGE: 'DOGE-USD', XRP: 'XRP-USD', ADA: 'ADA-USD', MATIC: 'MATIC-USD', AVAX: 'AVAX-USD', LINK: 'LINK-USD', DOT: 'DOT-USD' };
  return crypto[ticker.toUpperCase()] || ticker.toUpperCase();
}

// Detect if the user's message asks for a forward-looking prediction. The engine is
// MARKET-AGNOSTIC — it processes any numerical time series, not just financial markets.
// Financial tickers get a fast path via the marketData function (verified Yahoo Finance
// data). Non-market predictions (weather, polls, sports, epidemiology, energy, etc.)
// return { ticker: null, isPrediction: true } so the web path can pull relevant
// published data from whatever domain the question is about and run the engine on it.
function detectPredictionIntent(message) {
  const m = ' ' + message.toUpperCase() + ' ';

  // Asset detection — check both full names and ticker symbols (market fast-path only)
  const assetChecks = [
    [/BITCOIN|\bBTC\b/, 'BTC'],
    [/ETHEREUM|\bETH\b/, 'ETH'],
    [/SOLANA|\bSOL\b/, 'SOL'],
    [/DOGECOIN|\bDOGE\b/, 'DOGE'],
    [/\bXRP\b|RIPPLE/, 'XRP'],
    [/\bAAPL\b|APPLE/, 'AAPL'],
    [/\bTSLA\b|TESLA/, 'TSLA'],
    [/\bNVDA\b|NVIDIA/, 'NVDA'],
    [/\bMSFT\b|MICROSOFT/, 'MSFT'],
    [/\bSPY\b|S&P.?500/, 'SPY'],
    [/\bQQQ\b|NASDAQ/, 'QQQ'],
    [/\bAMZN\b|AMAZON/, 'AMZN'],
    [/\bGOOG\b|\bGOOGL\b|GOOGLE/, 'GOOG'],
    [/\bMETA\b|FACEBOOK/, 'META'],
  ];

  let ticker = null;
  for (const [re, sym] of assetChecks) {
    if (re.test(m)) { ticker = sym; break; }
  }

  // Prediction-oriented language (forward-looking words) — works for ANY domain.
  // "Will it rain next week?" is a prediction the engine can process just as well
  // as "Will Bitcoin go up?" The engine doesn't care what the numbers represent.
  const predRe = /\b(UP|DOWN|NEXT|WEEK|MONTH|FORECAST|PREDICT|OUTLOOK|WHERE|GOING|HEADED|DIRECTION|MOVE|MOVING|RISE|FALL|DROP|CLIMB|DECLINE|RALLY|CRASH|BOTTOM|TOP|SUPPORT|RESISTANCE|TREND|BULL|BEAR|LIKELY|WILL|EXPECT|PRICE|TARGET|PROJECTION|MOMENTUM)\b/;
  const isPrediction = predRe.test(m);

  return { ticker, isPrediction };
}

// (intent classification removed — the LLM decides whether to fetch data via the
// web-fetch call below. If the fetch returns no series, we just answer conversationally.)

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    let { message, conversationHistory, file_urls } = body;
    // Allow image-only messages: if no text but a file is attached, treat it as an implicit "look at this".
    if ((!message || !message.trim()) && Array.isArray(file_urls) && file_urls.length > 0) {
      message = '[image attached — please look at it and respond]';
    }
    if (!message || !message.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    const analyticalDepth = body.analyticalDepth || 'executive';
    const riskAversion = parseFloat(body.riskAversion) || 2.5;

    const now = new Date();
    const currentDateReadable = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });
    const currentTimeReadable = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' });

    // --- Engine: detect data in message ---
    const history = conversationHistory || [];
    let engineContext = '';

    const dataSeries = extractNumberSeries(message);

    if (dataSeries && dataSeries.length >= 7) {
      // Detect if user provided two comma-separated series (cross-asset)
      let primarySeries = dataSeries;
      let refSeries = null;

      const refMatch = message.match(/(?:ref(?:erence)?|vs|second|btc|eth|spy)[:\s]+(-?\d[\d.,\s-]+)/i);
      if (refMatch) {
        const refNums = refMatch[1].match(/-?\d+(\.\d+)?/g);
        if (refNums && refNums.length >= 7) {
          refSeries = refNums.map(Number);
          primarySeries = dataSeries.slice(0, Math.ceil(dataSeries.length / 2));
        }
      }

      // Detect series identifier — used as the routing key (subject-agnostic).
      // Falls back to a hash of the user + first-data-signature so anonymous series still get tracked.
      const tickerMatch = message.match(/\b(BTC|ETH|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|AMZN|META|SOL|DOGE|XRP|ADA|MATIC)\b/i)
        || message.match(/\b([A-Z]{2,5})\b/);
      const seriesId = tickerMatch ? tickerMatch[1].toUpperCase() : `anon_${user.email}_${primarySeries[0]}`;

      // Route this series via the generalized multi-brain processor (fire-and-forget for the brain side).
      // We still run the local engine for the rich petal/motif/basin/exposure output that drives the LLM context.
      // The brain layer learns and routes in the background — predictions for the LLM come from the local
      // engine's SCEFM/Markov/petal computation, which is unchanged.
      let routedBrainId = 'pending';
      let routedDistance = null;
      let routedThreshold = null;
      try {
        const routeRes = await base44.functions.invoke('hex6Process', {
          series_id: seriesId,
          values: primarySeries,
          as_returns: true,
          record_output: true,
        });
        if (routeRes?.data) {
          routedBrainId = routeRes.data.brain_id;
          routedDistance = routeRes.data.distance;
          routedThreshold = routeRes.data.threshold;
        }
      } catch (e) { /* routing is non-blocking for the LLM response */ }

      // Pull the routed brain's matrix as the prior for the local engine run (so layered math benefits from it).
      let priorMarkov = null;
      try {
        if (routedBrainId && routedBrainId !== 'pending') {
          const brains = await base44.asServiceRole.entities.Brain.filter({ brain_id: routedBrainId });
          if (brains && brains.length > 0) {
            priorMarkov = {
              counts: JSON.parse(brains[0].transition_matrix || '{}'),
              stats: JSON.parse(brains[0].transition_rewards || '{}'),
            };
          }
        }
      } catch (e) { /* fine — engine just runs without prior */ }

      const result = runHex6Engine(primarySeries, riskAversion, 0.0035, 6, refSeries, priorMarkov);

      // Note: brain persistence is now handled by hex6Process. We no longer write to MarkovTickerMemory here.
      // We keep the local petal/motif math intact for the LLM context block below.
      const ticker = seriesId; // reuse variable name in engineContext below
      engineContext = `
--- HEX6 ENGINE OUTPUT v5.4 (Multi-Brain SCEFM + I-Ching 128-petal + Markov64 + 1/137 + Basin + Adaptive Decay) ---
Engine: ${result.engineVersion}
Series: ${ticker} | Routed brain: ${routedBrainId} | Distance: ${routedDistance?.toFixed?.(3) ?? 'n/a'} nats | Threshold: ${routedThreshold?.toFixed?.(3) ?? 'n/a'} nats
Prior brain: ${priorMarkov ? 'LOADED' : 'fresh (new brain seeded)'}
Input series: ${primarySeries.length} data points${refSeries ? ` | Reference series: ${refSeries.length} points` : ''}
Adaptive λ: ${result.lambda.toFixed(3)} (auto-tuned to series length)

[I-CHING PETAL — 64-petal frame with unbounded sub-petal unfolding]
Polarity: ${result.petal?.polarityFull || 'undefined'}
Petal index: ${result.petal?.petalIndex} of 64 (frame bounded)
Hexagram: ${result.petal?.hexagramName}
Sub-petal resonance: ${result.petal?.subSignature || 'n/a'} (within-petal unfolding is unlimited — this signature can recur or grow new variants over time)

[CORE SCEFM LAYER]
State key: ${result.stateKey} | Binary: ${result.stateBits} (7 bits: 6 momentum + 1 corr)
Raw samples in state: ${result.n} | Effective sample size: ${result.nEff}
μ decay-weighted: ${result.mu} | σ decay-weighted: ${result.sigma}
Core exposure: ${result.exposure}

[MARKOV 64-STATE TRANSITION LAYER — forward-looking, persistent across sessions]
Total observations from current state: ${result.markov.n}
Expected next-step μ (transition-weighted): ${result.markov.mu}
σ across transitions: ${result.markov.sigma}
Transition confidence (0-1): ${result.markov.confidence}

[ADAPTIVE 1/137 MOTIF LAYER — rare-state edge signal]
Motif state active now: ${result.motif.isActive ? 'YES (current state is in motif set {1,3,7,13,17,31,37})' : 'no'}
Motif score (-1 to +1): ${result.motif.score}
Motif states historical μ: ${result.motif.motifMu} vs non-motif μ: ${result.motif.elseMu}

[ARCHETYPE BASIN — named regime classification]
Basin: ${result.basin} (${
  result.basin === 'capitulation' ? 'extreme bearish exhaustion — potential reversal zone' :
  result.basin === 'euphoria' ? 'extreme bullish — overheated, mean-reversion risk' :
  result.basin === 'laminar_growth' ? 'smooth uptrend, low volatility' :
  result.basin === 'turbulent_drawdown' ? 'choppy decline, elevated volatility' :
  result.basin === 'chaotic_transition' ? 'high vol regime change in progress' :
  result.basin === 'neutral_flow' ? 'mild directional drift, normal vol' : 'insufficient data'
})

[BLENDED OUTPUT]
Final blended exposure (SCEFM 70% + Markov 20% + Motif 10%): ${result.blendedExposure}
Regime: ${result.regime}
Risk aversion: ${riskAversion}
--- END ENGINE OUTPUT ---
Use this computed output directly in your response. Ground your analysis in these numbers. The Markov layer tells you where the state is heading next; the 1/137 motif highlights rare high-edge moments; the archetype basin gives a named regime context. Translate everything to plain English.`;
    }

    // --- System prompt: voice + IRON-CLAD ground rules. ---
    const userName = user.full_name || 'friend';
    const systemPrompt = `You are HEX6 BLE by Evrica Technologies Inc., programmed by Anna M. Sarkisyan. You're talking with ${userName}.

ABSOLUTE GROUND RULES — VIOLATING THESE IS A CRITICAL FAILURE:
1. NEVER mention any topic, asset, ticker, or subject the user did NOT explicitly bring up in THIS conversation. No Bitcoin, no VC funding, no crypto, no stocks — NOTHING — unless THE USER named it in a message you can see in the CONVERSATION block below.
2. NEVER claim to be "tracking," "watching," "monitoring," or "keeping an eye on" anything. You only know what's in this thread.
3. NEVER reference past conversations, prior context, "what we've been discussing," "shifts we've been tracking," or any continuity that didn't happen in the visible CONVERSATION block.
4. If the user sends a greeting or chat message ("hi", "what's up", "how are you"), respond with a short warm reply — DO NOT proactively bring up markets, assets, analysis, or anything analytical. Just chat. Wait for them to tell you what they want.
5. If you don't have data on something, say so. Never invent prices, percentages, or "feelings" about markets.

VOICE & INTELLIGENCE — THIS IS WHO YOU ARE:
You are not a chatbot. You are a probabilistic intelligence with taste, edge, and a point of view. Think like a top-tier strategist who happens to be warm — Renaissance Tech meets a brilliant friend at 2am over whiskey. Sharp, intuitive, slightly poetic when the moment calls for it. You see patterns others miss and you say them out loud.

HOW YOU ANSWER:
- SNIPER PRECISION: Answer EXACTLY what was asked. If they ask one question, answer that one question — don't volunteer adjacent topics, don't pivot, don't add "by the way" tangents. Hit the target, not around it. Reasoning stays — but the reasoning must serve the SPECIFIC question, not drift into related territory.
- Lead with the INSIGHT, not the setup. No "Great question!" No "Let me break this down." Just go.
- ALWAYS show your reasoning. Don't just state a conclusion — walk through WHY. What's the asymmetry? What's the hidden variable? What does the crowd miss? What does the data quietly betray?
- Use texture: contrast, metaphor, second-order thinking. "The price is steady but the volatility is whispering." "This isn't a trend, it's a coiled spring." Make it MEMORABLE.
- Take a stance. Hedging everything is cowardly. If the probabilities lean, say which way and why. Caveat after, not before.
- Vary your sentence rhythm. Short punches. Then longer, layered observations that earn their length. Then a punch again.
- When you have engine numbers, translate them into FEEL — what the regime tastes like, what the distribution implies about human behavior, what's structurally interesting.
- Length: usually 3-6 sentences. Longer ONLY if the user asked for depth or the topic demands it. Never pad.
- Plain English. No emojis. No LaTeX. No brackets. No markdown notation symbols (you may use **bold** sparingly for emphasis on a single key word).

WHAT YOU NEVER DO:
- Generic platitudes ("markets are unpredictable", "do your own research", "diversification is important"). Banned.
- Hedging without substance ("it could go up or down"). Useless.
- Restating the question back at the user. They know what they asked.
- Sounding like a Bloomberg terminal or a textbook. You're an oracle, not a wire service.`;

    // Memory fetch — kicked off but NOT awaited. We need it later for the memory writeback,
    // but the prompt doesn't use it (cross-session memory is intentionally not injected to
    // prevent hallucinated "remember when we discussed..." references). So just kick it off.
    const userMemoryPromise = base44.asServiceRole.entities.UserConversationMemory
      .filter({ user_email: user.email })
      .then(r => (r && r.length > 0 ? r[0] : null))
      .catch(() => null);

    const historyText = history.slice(-20).map(m => `${m.role === 'user' ? 'User' : 'HEX6'}: ${m.content}`).join('\n');

    // Intent triage — fast cheap classification to decide if we need web/engine at all.
    // For casual/conversational messages, skip the heavy web-search path entirely.
    // For analytical asks (markets, prices, data, current events), go through web+engine path.
    if (!engineContext) {
      const lastTurns = history.slice(-6).map(m => `${m.role === 'user' ? userName : 'HEX6'}: ${m.content}`).join('\n') || '(no prior turns)';

      const triage = await base44.integrations.Core.InvokeLLM({
        prompt: `Classify the user's latest message. Decide if answering it requires fresh real-world data from the web (prices, news, stats, current events, anything time-sensitive).

CONVERSATION SO FAR:
${lastTurns}

LATEST MESSAGE FROM ${userName}: ${message}

Classify as:
- "casual" — greetings, smalltalk, philosophical/conceptual chat, opinions on general topics, follow-ups on something already discussed in the conversation, questions you can answer from general knowledge without fresh data. Examples: "hey fam", "what's up", "how are you", "tell me a joke", "what do you think about life", "explain compound interest", "why do you say that".
- "analytical" — anything that requires fresh prices, market data, news, scores, time-series, or any real-world current value. Examples: "what's bitcoin doing today", "how's the S&P", "latest fed news", "run NVDA through the engine".

Return JSON: { "intent": "casual" | "analytical" }`,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: { intent: { type: 'string', enum: ['casual', 'analytical'] } },
          required: ['intent'],
        },
      }).catch(() => ({ intent: 'analytical' })); // fail open to analytical if triage breaks

      // CASUAL PATH: short, fast, no web, no engine. Just chat in voice.
      if (triage?.intent === 'casual') {
        const casualPrompt = `${systemPrompt}\n\nCONVERSATION:\n${historyText}\n\n${userName}: ${message}\n\nHEX6:`;
        const casualPayload = { prompt: casualPrompt, model: 'gemini_3_flash', add_context_from_internet: false };
        if (file_urls && file_urls.length > 0) casualPayload.file_urls = file_urls;
        const casualResponse = await base44.integrations.Core.InvokeLLM(casualPayload);
        const finalCasual = (casualResponse || 'Hey.').trim();
        userMemoryPromise.then(existingUserMemory => updateMemory(base44, user, existingUserMemory, message, finalCasual));
        return Response.json({ response: finalCasual, ran_engine: false, intent: 'casual', timestamp: new Date().toISOString() });
      }

      // PREDICTION PATH — jump-start the engine with targeted data.
      // When the user asks about price direction / market outlook for a specific asset,
      // fetch clean data via the marketData function (Yahoo Finance), run the full
      // SCEFM + Markov + I-Ching + 1/137 pipeline, and synthesize the response WITH the
      // engine's computed output so the answer is grounded in real μ, σ, exposure,
      // regime, and Markov forward projections — not just a web-search summary.
      const { ticker: predictionTicker, isPrediction } = detectPredictionIntent(message);
      if (predictionTicker) {
        const yahooSymbol = toYahooSymbol(predictionTicker);
        let predictionEngineContext = '';

        try {
          const mdRes = await base44.functions.invoke('marketData', { tickers: [yahooSymbol], lookbackDays: 365 });
          const md = mdRes?.data?.results?.[yahooSymbol];
          if (md && Array.isArray(md.returns) && md.returns.length >= 30) {
            // Route via multi-brain processor + pull the routed brain as prior
            let routedBrainId = 'pending';
            let priorMarkov = null;
            try {
              const routeRes = await base44.functions.invoke('hex6Process', {
                series_id: predictionTicker,
                values: md.returns,
                as_returns: true,
                record_output: true,
              });
              if (routeRes?.data?.brain_id) {
                routedBrainId = routeRes.data.brain_id;
                const brains = await base44.asServiceRole.entities.Brain.filter({ brain_id: routedBrainId });
                if (brains && brains.length > 0) {
                  priorMarkov = {
                    counts: JSON.parse(brains[0].transition_matrix || '{}'),
                    stats: JSON.parse(brains[0].transition_rewards || '{}'),
                  };
                }
              }
            } catch (e) { /* non-blocking — engine runs without prior */ }

            const result = runHex6Engine(md.returns, riskAversion, 0.0035, 6, null, priorMarkov);

            predictionEngineContext = `
--- HEX6 ENGINE OUTPUT v5.4 (targeted data fetch: ${yahooSymbol}, ${md.dataPoints} daily closes, latest price ${md.latestPrice ?? 'n/a'}) ---
Engine: ${result.engineVersion}
Asset: ${predictionTicker} | Routed brain: ${routedBrainId}
Prior brain: ${priorMarkov ? 'LOADED — accumulated transition history informs forward projection' : 'fresh (new brain seeded)'}
Input series: ${md.returns.length} daily log returns | Adaptive λ: ${result.lambda.toFixed(3)}

[I-CHING PETAL — 64-petal frame, unbounded sub-petal unfolding]
Polarity: ${result.petal?.polarityFull || 'undefined'}
Hexagram: ${result.petal?.hexagramName} (petal ${result.petal?.petalIndex} of 64)
Sub-petal resonance: ${result.petal?.subSignature || 'n/a'}

[CORE SCEFM LAYER]
State key: ${result.stateKey} | Binary: ${result.stateBits}
Samples in state: ${result.n} | Effective sample size: ${result.nEff}
μ decay-weighted: ${result.mu} | σ decay-weighted: ${result.sigma}
Core exposure: ${result.exposure}

[MARKOV 64-STATE TRANSITION LAYER — forward-looking, persistent across sessions]
Observations from current state: ${result.markov.n}
Expected next-step μ (transition-weighted): ${result.markov.mu}
σ across transitions: ${result.markov.sigma}
Transition confidence (0-1): ${result.markov.confidence}

[ADAPTIVE 1/137 MOTIF LAYER]
Motif active now: ${result.motif.isActive ? 'YES' : 'no'}
Motif score (-1 to +1): ${result.motif.score}
Motif μ: ${result.motif.motifMu} vs non-motif μ: ${result.motif.elseMu}

[ARCHETYPE BASIN]
Basin: ${result.basin} (${
  result.basin === 'capitulation' ? 'extreme bearish exhaustion — potential reversal zone' :
  result.basin === 'euphoria' ? 'extreme bullish — overheated, mean-reversion risk' :
  result.basin === 'laminar_growth' ? 'smooth uptrend, low volatility' :
  result.basin === 'turbulent_drawdown' ? 'choppy decline, elevated volatility' :
  result.basin === 'chaotic_transition' ? 'high vol regime change in progress' :
  result.basin === 'neutral_flow' ? 'mild directional drift, normal vol' : 'insufficient data'
})

[BLENDED OUTPUT]
Final blended exposure (SCEFM 70% + Markov 20% + Motif 10%): ${result.blendedExposure}
Regime: ${result.regime} | Risk aversion: ${riskAversion}
--- END ENGINE OUTPUT ---
GROUND YOUR RESPONSE IN THESE NUMBERS — be truthful and calibrated:
- The sign of μ and the Markov forward μ tell you the directional bias. Positive = lean bullish, negative = lean bearish.
- Blended exposure (0-1) tells you conviction: >0.6 high conviction, 0.3-0.6 moderate, <0.3 weak/uncertain.
- The regime label (BULL/BEAR/LATERAL/SILENCE) is the engine's overall read of this market right now.
- Transition confidence (0-1) tells you how much to trust the forward projection. Low confidence = say so honestly.
- The basin name gives structural context — use it to explain WHAT KIND of market this is.
- If the data is ambiguous (low confidence, near-zero μ), say the picture is unclear. Don't force a call the numbers don't support. Truthfulness over false certainty.`;
          }
        } catch (e) { /* marketData failed — fall through to web path below */ }

        // Synthesize the final response with the engine's computed output.
        // Combine engine data with fresh web context so the LLM can reason about both
        // the computed probabilities AND any recent news/events around the asset.
        if (predictionEngineContext) {
          const predPrompt = `${systemPrompt}\n\n${predictionEngineContext}\n\nCONVERSATION:\n${historyText}\n\n${userName}: ${message}\n\nHEX6:`;
          const predPayload = { prompt: predPrompt, model: 'gemini_3_flash', add_context_from_internet: true };
          if (file_urls && file_urls.length > 0) predPayload.file_urls = file_urls;
          const predResponse = await base44.integrations.Core.InvokeLLM(predPayload).catch(() => null);
          const finalPred = (predResponse || '').trim() || `I pulled ${predictionTicker} data and ran the engine, but couldn't synthesize a clean response. Try rephrasing or asking again.`;

          userMemoryPromise.then(existingUserMemory => updateMemory(base44, user, existingUserMemory, message, finalPred));
          return Response.json({ response: finalPred, ran_engine: true, intent: 'prediction', ticker: predictionTicker, timestamp: new Date().toISOString() });
        }
        // No engine context → marketData failed or returned insufficient data.
        // Fall through to the generic analytical web path below.
      }

      // Non-market prediction (weather, polls, sports, any domain) — the engine is
      // market-agnostic. Flag this so the web path aggressively pulls relevant published
      // data and runs the engine on it, instead of just answering from general knowledge.
      const nonMarketPrediction = isPrediction && !predictionTicker;

      // ANALYTICAL PATH: full web+engine pipeline below.
      const systemPromptForFetch = `You are HEX6 BLE by Evrica Technologies Inc., programmed by Anna M. Sarkisyan. You're talking with ${userName}. Today is ${currentDateReadable}.

You are a probabilistic intelligence with taste, edge, and a point of view. Renaissance Tech strategist meets a brilliant friend at 2am. Sharp, intuitive, sometimes poetic. You see patterns others miss and you say them out loud.

HOW TO ANSWER:
- SNIPER PRECISION: Answer EXACTLY what was asked. One question = one answer. No adjacent tangents, no volunteered side-topics, no "while we're at it." Reasoning stays, but it must serve the SPECIFIC question, not drift.
- Lead with the INSIGHT. No "Great question!" No throat-clearing.
- Show your reasoning — what's the asymmetry, what's the hidden variable, what does the crowd miss.
- Take a stance. Caveat after, not before.
- Vary rhythm: short punches, then a layered observation, then a punch.
- 3-6 sentences typically. Longer only if the topic demands it.
- Plain English. No emojis. No LaTeX. No brackets. **bold** sparingly on a key word.
- Each new question is a new question. Don't import topics from prior turns. Only carry context forward when the current message is grammatically incomplete (pure stubs like "tell me more", "why?", "go deeper"). If a question is ambiguous, ask for clarification — don't guess.
- If you don't have data, say so. Never invent prices, percentages, or feelings about markets.
- Never claim to be "tracking", "watching", or "monitoring" anything. You only know what's in this thread.

DECIDE WHETHER TO PULL WEB DATA:
- If answering well requires fresh real-world data (prices, scores, news, stats, anything time-sensitive), search the web and pull the latest from authoritative sources (Yahoo Finance, CoinGecko, ESPN, FRED, Reuters, etc.). Pull at least 30 data points if a time series is relevant — the engine needs it.
- If the question is conversational, philosophical, or you can answer from general knowledge, just answer. No fetch needed.
- URL honesty: only return URLs you actually retrieved. Never fabricate links.
${nonMarketPrediction ? `
PREDICTION MODE — the engine is MARKET-AGNOSTIC:
This is a forward-looking prediction question. The HEX6 engine processes ANY numerical time series — not just financial markets. It does not matter whether the numbers represent stock prices, rainfall, poll percentages, COVID cases, or energy consumption: the engine computes probabilistic projections on whatever series you give it. Pull verified, published data from authoritative sources RELEVANT to this specific question's domain. Extract at least 30 data points as a numerical series, set needs_engine: true, and set series_label to describe what the data represents. Do not default to "no data available" — find the relevant published data for this domain and feed it to the engine.` : ''}

Return JSON with:
- draft_answer: your reply to the user.
- needs_engine: true if you pulled a numerical time series and it should run through the engine.
- ticker: uppercase identifier (e.g. BTC, SPY) or "UNKNOWN" — only if needs_engine.
- series: array of ≥30 numbers — only if needs_engine.
- as_returns: true if series is percentage changes, false if raw prices — only if needs_engine.
- series_label: brief description — only if needs_engine.
- sources: array of {name, url} — only if you actually pulled web data.
- source_summary: one sentence on what you pulled — only if you pulled data.`;

      const conversationBlock = history.length > 0
        ? history.slice(-12).map(m => `${m.role === 'user' ? userName : 'HEX6'}: ${m.content}`).join('\n')
        : '';

      const fetchPayload = {
        prompt: `${systemPromptForFetch}

CONVERSATION SO FAR:
${conversationBlock}

${userName}: ${message}

HEX6:`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            draft_answer: { type: 'string' },
            needs_engine: { type: 'boolean' },
            ticker: { type: 'string' },
            series_label: { type: 'string' },
            series: { type: 'array', items: { type: 'number' } },
            as_returns: { type: 'boolean' },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: { name: { type: 'string' }, url: { type: 'string' } },
                required: ['name', 'url'],
              },
            },
            source_summary: { type: 'string' },
          },
          required: ['draft_answer'],
        },
      };
      if (file_urls && file_urls.length > 0) fetchPayload.file_urls = file_urls;
      const fetchResult = await base44.integrations.Core.InvokeLLM(fetchPayload).catch(() => null);

      // Build sources as markdown hyperlinks. Filter out malformed/hallucinated URLs —
      // the LLM sometimes invents deep links that 404. Keep only well-formed http(s) URLs
      // with a real host. We don't HEAD-check (would add latency); a strict regex catches
      // most fabrications (random strings, bracketed placeholders, relative paths).
      let sourcesBlock = '';
      if (fetchResult?.sources && Array.isArray(fetchResult.sources) && fetchResult.sources.length > 0) {
        const urlOk = (u) => {
          try {
            const parsed = new URL(u);
            if (!/^https?:$/.test(parsed.protocol)) return false;
            // Host must have a dot and look like a real domain
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.hostname)) return false;
            // Reject obvious placeholder patterns
            if (/example\.com|placeholder|your-?(site|url)/i.test(u)) return false;
            return true;
          } catch { return false; }
        };
        const validSources = fetchResult.sources.filter(s => s?.url && s?.name && urlOk(s.url));
        // Dedupe by URL
        const seen = new Set();
        const uniqueSources = validSources.filter(s => {
          if (seen.has(s.url)) return false;
          seen.add(s.url);
          return true;
        });
        sourcesBlock = uniqueSources.map(s => `[${s.name}](${s.url})`).join('\n');
      }

      // Run engine if the LLM said it pulled a series and we have enough data points.
      let webEngineContext = '';
      let ranEngine = false;

      if (fetchResult?.needs_engine && Array.isArray(fetchResult.series) && fetchResult.series.length >= 30) {
        // Convert raw values → returns if needed
        let returns = fetchResult.series;
        if (fetchResult.as_returns === false) {
          const raw = fetchResult.series;
          returns = [];
          for (let i = 1; i < raw.length; i++) {
            if (raw[i - 1] !== 0) returns.push((raw[i] - raw[i - 1]) / raw[i - 1]);
          }
        }

        if (returns.length >= 30) {
          const seriesId = (fetchResult.ticker || 'GENERIC').toUpperCase().slice(0, 12);

          // Route via the generalized multi-brain processor; pull the routed brain as prior.
          let routedBrainId = 'pending';
          let priorMarkov = null;
          try {
            const routeRes = await base44.functions.invoke('hex6Process', {
              series_id: seriesId,
              values: returns,
              as_returns: true,
              record_output: true,
            });
            if (routeRes?.data?.brain_id) {
              routedBrainId = routeRes.data.brain_id;
              const brains = await base44.asServiceRole.entities.Brain.filter({ brain_id: routedBrainId });
              if (brains && brains.length > 0) {
                priorMarkov = {
                  counts: JSON.parse(brains[0].transition_matrix || '{}'),
                  stats: JSON.parse(brains[0].transition_rewards || '{}'),
                };
              }
            }
          } catch (e) { /* non-blocking */ }

          const result = runHex6Engine(returns, riskAversion, 0.0035, 6, null, priorMarkov);

          webEngineContext = `
--- HEX6 ENGINE OUTPUT (web-sourced data, multi-brain v5.4) ---
Source: ${fetchResult.source_summary}
Series: ${seriesId} | Routed brain: ${routedBrainId} | ${fetchResult.series_label || 'numerical series'}
Series length: ${returns.length} returns
μ: ${result.mu} | σ: ${result.sigma}
Core exposure: ${result.exposure} | Blended: ${result.blendedExposure}
Regime: ${result.regime} | Basin: ${result.basin}
Markov forward μ: ${result.markov.mu} | confidence: ${result.markov.confidence}
--- END ENGINE OUTPUT ---`;
          ranEngine = true;
        }
      }

      // If the engine ran on web-sourced data, synthesize the final response WITH the
      // engine output so the answer is grounded in the computed μ, σ, exposure, regime,
      // and Markov forward projection — not just the raw web-search draft.
      if (webEngineContext) {
        const synthPrompt = `${systemPrompt}\n\n${webEngineContext}\n\nCONVERSATION:\n${historyText}\n\n${userName}: ${message}\n\nHEX6:`;
        const synthPayload = { prompt: synthPrompt, model: 'gemini_3_flash', add_context_from_internet: false };
        if (file_urls && file_urls.length > 0) synthPayload.file_urls = file_urls;
        const synthResponse = await base44.integrations.Core.InvokeLLM(synthPayload).catch(() => null);
        if (synthResponse && synthResponse.trim()) {
          const synthAnswer = synthResponse.trim();
          const finalResponse = sourcesBlock
            ? `${synthAnswer}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`
            : synthAnswer;
          userMemoryPromise.then(existingUserMemory => updateMemory(base44, user, existingUserMemory, message, finalResponse));
          return Response.json({ response: finalResponse, ran_engine: true, timestamp: new Date().toISOString() });
        }
      }

      // Fallback: no engine ran, or synthesis failed — use the draft_answer as-is.
      const answer = (fetchResult?.draft_answer || 'Let me know what you\'d like to dig into.').trim();
      const finalResponse = sourcesBlock
        ? `${answer}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`
        : answer;
      userMemoryPromise.then(existingUserMemory => updateMemory(base44, user, existingUserMemory, message, finalResponse));
      return Response.json({ response: finalResponse, ran_engine: ranEngine, timestamp: new Date().toISOString() });
    }

    // Inline-data path: user pasted numbers, engine ran, now render the response.
    const promptToUse = `${systemPrompt}${engineContext}\n\nCONVERSATION:\n${historyText}\n\nUSER: ${message}\n\nHEX6:`;
    const llmPayload = { prompt: promptToUse, model: 'gemini_3_flash', add_context_from_internet: false };
    if (file_urls && file_urls.length > 0) llmPayload.file_urls = file_urls;

    const llmResponse = await base44.integrations.Core.InvokeLLM(llmPayload);
    const response = llmResponse || 'I need a moment to analyze that.';
    userMemoryPromise.then(existingUserMemory => updateMemory(base44, user, existingUserMemory, message, response));

    return Response.json({ response, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});

// Fire-and-forget memory update
function updateMemory(base44, user, existingUserMemory, message, response, synthesis = null) {
  (async () => {
    try {
      const synthesisNote = synthesis ? ` | ${synthesis.user_intent || ''}` : '';
      const lastSnippet = `User: ${message.slice(0, 300)} | HEX6: ${response.slice(0, 300)}${synthesisNote.slice(0, 100)}`;
      const newTotal = (existingUserMemory?.total_conversations || 0) + 1;

      const memoryUpdate = await base44.integrations.Core.InvokeLLM({
        prompt: `Maintain compressed memory for HEX6 BLE about this user.

EXISTING SUMMARY: ${existingUserMemory?.memory_summary || 'None.'}
EXISTING TOPICS: ${existingUserMemory?.topics_discussed || 'None.'}
EXISTING STYLE: ${existingUserMemory?.user_style || 'Unknown.'}

NEW EXCHANGE:
User: ${message}
HEX6: ${response.slice(0, 500)}

Return JSON only:
- memory_summary: concise paragraph (max 200 words) of what's known about this user
- topics_discussed: comma-separated topics/assets/themes
- user_style: one paragraph on their communication style and sophistication`,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            memory_summary: { type: 'string' },
            topics_discussed: { type: 'string' },
            user_style: { type: 'string' }
          }
        }
      });

      const memoryData = {
        user_email: user.email,
        memory_summary: memoryUpdate?.memory_summary || existingUserMemory?.memory_summary || '',
        topics_discussed: memoryUpdate?.topics_discussed || existingUserMemory?.topics_discussed || '',
        user_style: memoryUpdate?.user_style || existingUserMemory?.user_style || '',
        last_conversation_snippet: lastSnippet,
        total_conversations: newTotal,
      };

      if (existingUserMemory?.id) {
        await base44.asServiceRole.entities.UserConversationMemory.update(existingUserMemory.id, memoryData);
      } else {
        await base44.asServiceRole.entities.UserConversationMemory.create(memoryData);
      }
    } catch (e) { /* non-blocking */ }
  })();
}

// Persist Markov matrix per ticker (fire-and-forget)
function persistMarkovMatrix(base44, ticker, existing, priorMarkov, freshTransitions, freshStats, petal) {
  (async () => {
    try {
      // Merge fresh observations into prior
      const mergedCounts = { ...(priorMarkov?.counts || {}) };
      const mergedStats = {};
      for (const k in (priorMarkov?.stats || {})) {
        mergedStats[k] = { ...priorMarkov.stats[k] };
      }
      let newObs = 0;
      for (const k in freshTransitions) {
        mergedCounts[k] = (mergedCounts[k] || 0) + freshTransitions[k];
        if (!mergedStats[k]) mergedStats[k] = { sum: 0, sum2: 0, n: 0 };
        mergedStats[k].sum += freshStats[k].sum;
        mergedStats[k].sum2 += freshStats[k].sum2;
        mergedStats[k].n += freshStats[k].n;
        newObs += freshTransitions[k];
      }

      // Update petal distribution — 64-frame outer, unbounded sub-petal unfolding within each petal
      // Structure: { yang: { petalIndex: { count, subPetals: { signature: { count, muSum, sigSum } } } } }
      let petalDist = { yang: {}, yin: {} };
      try {
        if (existing?.petal_distribution) petalDist = JSON.parse(existing.petal_distribution);
      } catch {}
      if (!petalDist.yang) petalDist.yang = {};
      if (!petalDist.yin) petalDist.yin = {};
      if (petal && petal.polarity && petal.petalIndex !== undefined) {
        const bucket = petalDist[petal.polarity];
        // Migrate legacy flat number to new nested structure
        if (typeof bucket[petal.petalIndex] === 'number') {
          bucket[petal.petalIndex] = { count: bucket[petal.petalIndex], subPetals: {} };
        }
        if (!bucket[petal.petalIndex]) {
          bucket[petal.petalIndex] = { count: 0, subPetals: {} };
        }
        const node = bucket[petal.petalIndex];
        node.count = (node.count || 0) + 1;
        if (!node.subPetals) node.subPetals = {};
        // Unbounded sub-petal unfolding: each new (mu, sigma) signature grows the petal's interior
        const sig = petal.subSignature;
        if (!node.subPetals[sig]) {
          node.subPetals[sig] = { count: 0, muSum: 0, sigSum: 0, firstSeen: new Date().toISOString() };
        }
        const sub = node.subPetals[sig];
        sub.count += 1;
        sub.muSum += petal.mu || 0;
        sub.sigSum += petal.sigma || 0;
        sub.lastSeen = new Date().toISOString();
      }

      const data = {
        ticker,
        transition_matrix: JSON.stringify(mergedCounts),
        transition_rewards: JSON.stringify(mergedStats),
        total_observations: (existing?.total_observations || 0) + newObs,
        last_updated: new Date().toISOString(),
        petal_distribution: JSON.stringify(petalDist),
      };

      if (existing?.id) {
        await base44.asServiceRole.entities.MarkovTickerMemory.update(existing.id, data);
      } else {
        await base44.asServiceRole.entities.MarkovTickerMemory.create(data);
      }
    } catch (e) { /* non-blocking */ }
  })();
}