// ---------------------------------------------------------------------------
// HEX6 BLE Thinking Engine — the unified math beneath the model switch.
//
// One organism, one sequence.
//   Reason  (HEX6-BLE): "What is possible?"   → structural probability
//   Understand (PI-US): "What is meaningful?" → wave resonance + value
//
// Legacy model = Reason layer only (structural probability).
// PI-US model  = Reason + Understand fused (probability × resonance × value),
//                with tone modulation — the intuition layer on top of HEX6-BLE.
// This layer never writes to the Core (Law 1); only validated experience does.
// ---------------------------------------------------------------------------

// ===========================================================================
// REASON LAYER  (HEX6-BLE) — structural / probabilistic
// Reuses the proven SCEFM + Markov + I-Ching + 1/137 + Basin math.
// ===========================================================================

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

function pearsonCorr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const mb = b.slice(0, n).reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const ai = a[i]-ma, bi = b[i]-mb; num += ai*bi; da += ai*ai; db += bi*bi; }
  return (da === 0 || db === 0) ? 0 : num / Math.sqrt(da * db);
}

function adaptiveLambda(seriesLength) {
  if (seriesLength < 30) return 0.97;
  if (seriesLength < 80) return 0.95;
  if (seriesLength < 200) return 0.94;
  if (seriesLength < 500) return 0.92;
  return 0.90;
}

function encodeState6(slice) {
  if (slice.length < 6) return null;
  const bits = slice.slice(-6).map(r => r > 0 ? '1' : '0').join('');
  return parseInt(bits, 2);
}

function markovEdge(returns, priorCounts = null, priorStats = null) {
  if (returns.length < 8) return { mu: 0, sigma: 0, n: 0, transitionConfidence: 0, currentState: null };
  const freshCounts = {};
  const freshStats = {};
  for (let i = 6; i < returns.length - 1; i++) {
    const s0 = encodeState6(returns.slice(i - 6, i));
    const s1 = encodeState6(returns.slice(i - 5, i + 1));
    if (s0 === null || s1 === null) continue;
    const key = `${s0}->${s1}`;
    freshCounts[key] = (freshCounts[key] || 0) + 1;
    if (!freshStats[key]) freshStats[key] = { sum: 0, sum2: 0, n: 0 };
    const r = returns[i + 1];
    freshStats[key].sum += r; freshStats[key].sum2 += r * r; freshStats[key].n += 1;
  }
  const mergedCounts = { ...(priorCounts || {}) };
  const mergedStats = {};
  for (const k in (priorStats || {})) mergedStats[k] = { ...priorStats[k] };
  for (const k in freshCounts) {
    mergedCounts[k] = (mergedCounts[k] || 0) + freshCounts[k];
    if (!mergedStats[k]) mergedStats[k] = { sum: 0, sum2: 0, n: 0 };
    mergedStats[k].sum += freshStats[k].sum; mergedStats[k].sum2 += freshStats[k].sum2; mergedStats[k].n += freshStats[k].n;
  }
  const currentState = encodeState6(returns.slice(-6));
  if (currentState === null) return { mu: 0, sigma: 0, n: 0, transitionConfidence: 0, currentState: null };
  let totalCount = 0; const transitions = [];
  for (const key in mergedCounts) { if (key.startsWith(`${currentState}->`)) { totalCount += mergedCounts[key]; transitions.push({ key, count: mergedCounts[key], stats: mergedStats[key] }); } }
  if (totalCount === 0) return { mu: 0, sigma: 0, n: 0, transitionConfidence: 0, currentState };
  let mu = 0, secondMoment = 0;
  for (const t of transitions) { const prob = t.count / totalCount; const meanR = t.stats.n > 0 ? t.stats.sum / t.stats.n : 0; const meanR2 = t.stats.n > 0 ? t.stats.sum2 / t.stats.n : 0; mu += prob * meanR; secondMoment += prob * meanR2; }
  const sigma = Math.sqrt(Math.max(0, secondMoment - mu * mu));
  return { mu, sigma, n: totalCount, transitionConfidence: Math.min(1, totalCount / 30), currentState };
}

const MOTIF_STATES = new Set([1, 3, 7, 13, 17, 31, 37]);

function adaptive137Score(returns) {
  if (returns.length < 8) return { score: 0, isMotifNow: false, motifMu: 0, elseMu: 0 };
  let motifSum=0, motifN=0, elseSum=0, elseN=0;
  for (let i = 6; i < returns.length; i++) {
    const state = encodeState6(returns.slice(i - 6, i));
    if (state === null) continue;
    const r = returns[i];
    if (MOTIF_STATES.has(state)) { motifSum += r; motifN++; } else { elseSum += r; elseN++; }
  }
  const motifMu = motifN > 0 ? motifSum / motifN : 0;
  const elseMu = elseN > 0 ? elseSum / elseN : 0;
  const motifVar = motifN > 0 ? Math.max(1e-8, motifSum*motifSum/(motifN*motifN) - 0) : 1e-4;
  const currentState = encodeState6(returns.slice(-6));
  const isMotifNow = currentState !== null && MOTIF_STATES.has(currentState);
  if (!isMotifNow || motifN < 3) return { score: 0, isMotifNow, motifMu, elseMu };
  return { score: Math.tanh((motifMu - elseMu) / Math.sqrt(motifVar)), isMotifNow, motifMu, elseMu };
}

function classifyBasin(stateKey6, mu, sigma) {
  if (stateKey6 === null || stateKey6 === undefined) return 'undefined';
  if (stateKey6 === 0) return 'capitulation';
  if (stateKey6 === 63) return 'euphoria';
  if (mu > 0 && sigma < 0.01) return 'laminar_growth';
  if (mu < 0 && sigma > 0.02) return 'turbulent_drawdown';
  if (sigma > 0.025) return 'chaotic_transition';
  return 'neutral_flow';
}

export function runReasonLayer(returns, riskAversion = 2.5, friction = 0.0035, windowSize = 6, refReturns = null, priorMarkov = null) {
  const LAMBDA = adaptiveLambda(returns.length);
  const hive = {};
  for (let i = windowSize; i < returns.length; i++) {
    const slice = returns.slice(i - windowSize, i);
    const momentumBits = parseInt(slice.map(r => r > 0 ? '1' : '0').join(''), 2);
    let corrBit = 0;
    if (refReturns && refReturns.length >= i) {
      const corrWindow = Math.min(windowSize * 2, i);
      corrBit = pearsonCorr(returns.slice(i - corrWindow, i), refReturns.slice(i - corrWindow, i)) > 0.4 ? 1 : 0;
    } else {
      const longWindow = Math.min(12, i);
      const posCount = returns.slice(i - longWindow, i).filter(r => r > 0).length;
      corrBit = posCount / longWindow > 0.6 ? 1 : 0;
    }
    const key = (momentumBits << 1) | corrBit;
    const age = returns.length - 1 - i;
    const weight = Math.pow(LAMBDA, age);
    if (!hive[key]) hive[key] = [];
    hive[key].push({ value: returns[i], weight });
  }
  const recentSlice = returns.slice(-windowSize);
  const momentumKey = parseInt(recentSlice.map(r => r > 0 ? '1' : '0').join(''), 2);
  let currentCorrBit = 0;
  if (refReturns && refReturns.length >= windowSize * 2) {
    currentCorrBit = pearsonCorr(returns.slice(-windowSize * 2), refReturns.slice(-windowSize * 2)) > 0.4 ? 1 : 0;
  } else {
    const posCount = returns.slice(-12).filter(r => r > 0).length;
    currentCorrBit = posCount / Math.min(12, returns.length) > 0.6 ? 1 : 0;
  }
  const stateKey = (momentumKey << 1) | currentCorrBit;
  const stateBits = stateKey.toString(2).padStart(7, '0');
  const bin = hive[stateKey] || [];
  if (bin.length < 3) {
    return { mu:0, sigma:0, exposure:0, blendedExposure:0, stateKey, stateBits, n:bin.length, nEff:0, regime:'INSUFFICIENT_DATA', basin:'undefined', lambda:LAMBDA, markov:{mu:0,sigma:0,n:0,confidence:0}, motif:{score:0,isActive:false} };
  }
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
  if (muLb > 0) exposure = Math.min(Math.max((muLb / sigma ** 2) / riskAversion, 0), 1);
  const regime = exposure > 0.6 ? 'BULL' : exposure > 0.3 ? 'LATERAL' : mu < 0 ? 'BEAR' : 'SILENCE';
  const markov = markovEdge(returns, priorMarkov?.counts || null, priorMarkov?.stats || null);
  const motif = adaptive137Score(returns);
  const basin = classifyBasin(markov.currentState, mu, sigma);
  let blendedExposure = exposure;
  if (markov.transitionConfidence > 0.3 && markov.sigma > 0) {
    const markovExposure = Math.min(Math.max((markov.mu / (markov.sigma * markov.sigma)) / riskAversion, 0), 1);
    blendedExposure = Math.min(Math.max(0.7 * exposure + 0.2 * markovExposure + 0.1 * Math.max(0, motif.score), 0), 1);
  }
  return {
    mu: parseFloat(mu.toFixed(6)), sigma: parseFloat(sigma.toFixed(6)),
    exposure: parseFloat(exposure.toFixed(4)), blendedExposure: parseFloat(blendedExposure.toFixed(4)),
    stateKey, stateBits, n: bin.length, nEff, regime, basin, lambda: LAMBDA,
    markov: { mu: parseFloat(markov.mu.toFixed(6)), sigma: parseFloat(markov.sigma.toFixed(6)), n: markov.n, confidence: parseFloat(markov.transitionConfidence.toFixed(3)) },
    motif: { score: parseFloat(motif.score.toFixed(4)), isActive: motif.isMotifNow },
  };
}

// ===========================================================================
// UNDERSTAND LAYER  (PI-US) — waves / frequency / resonance / value
// "Thinks in waves": treats the return series as a signal, computes its
// spectral composition, and reads the resonance (how coherent the dominant
// wave is) — then fuses with the Reason layer's probability via Pascal value.
// ===========================================================================

export function runWaveLayer(returns) {
  const n = returns.length;
  if (n < 8) return { dominantFrequency: 0, dominantPeriod: 0, spectralConcentration: 0, resonance: 0, waveAmplitude: 0, phaseAlignment: 0, spectrum: [] };

  const mean = returns.reduce((s, x) => s + x, 0) / n;
  const centered = returns.map(r => r - mean);
  const maxK = Math.floor(n / 2);
  const spectrum = [];
  for (let k = 1; k <= maxK; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const phase = (2 * Math.PI * k * t) / n;
      re += centered[t] * Math.cos(phase);
      im -= centered[t] * Math.sin(phase);
    }
    const power = (re * re + im * im) / (n * n);
    spectrum.push({ k, power, re, im });
  }
  const totalPower = spectrum.reduce((s, f) => s + f.power, 0) || 1e-12;
  let dominant = spectrum[0];
  for (const f of spectrum) if (f.power > dominant.power) dominant = f;
  const dominantFrequency = dominant.k;
  const dominantPeriod = dominantFrequency > 0 ? Math.round(n / dominantFrequency) : n;
  const spectralConcentration = totalPower > 0 ? dominant.power / totalPower : 0;
  const std = Math.sqrt(centered.reduce((s, x) => s + x * x, 0) / n) || 1e-8;
  const waveAmplitude = Math.sqrt(dominant.power) / std;
  // Resonance: a pure coherent tone → concentration near 1 and amplitude strong → resonance near 1.
  const resonance = Math.min(1, Math.tanh(spectralConcentration * 3) * Math.min(1, waveAmplitude * 2));
  const phase = Math.atan2(-dominant.im, dominant.re);
  const phaseAlignment = Math.min(1, Math.abs(Math.cos(phase)));

  return {
    dominantFrequency,
    dominantPeriod,
    spectralConcentration: parseFloat(spectralConcentration.toFixed(4)),
    resonance: parseFloat(resonance.toFixed(4)),
    waveAmplitude: parseFloat(waveAmplitude.toFixed(4)),
    phaseAlignment: parseFloat(phaseAlignment.toFixed(4)),
    phase: parseFloat(phase.toFixed(4)),
  };
}

// Pascal Validation — the judge. Measures structural SUPPORT, not value.
// A conclusion earns confidence only when all four pillars are strong; the
// product rewards balanced, well-supported reads over isolated peaks.
//   Evidence    — how much information backs this (sample size + transition reliability)
//   Agreement  — do independent signals point the same way (probability ↔ resonance)
//   Consistency — does it fit the existing rhythm (phase coherence over time)
//   Coverage   — does it explain most of what we observe (spectral concentration)
export function runValidationLayer(reason, wave) {
  const probability = Math.min(1, Math.abs(reason.blendedExposure || reason.exposure || 0));
  const resonance   = wave.resonance || 0;
  const evidence    = Math.min(1, 0.6 * Math.min(1, (reason.nEff || 0) / 30) + 0.4 * (reason.markov?.confidence || 0));
  const agreement   = Math.min(1, Math.sqrt(probability * resonance));
  const consistency = wave.phaseAlignment || 0;
  const coverage    = wave.spectralConcentration || 0;
  const support     = evidence * agreement * consistency * coverage;
  const direction   = reason.mu > 0 ? 'UP' : reason.mu < 0 ? 'DOWN' : 'FLAT';
  // The judge's confidence: geometric mean of the four pillars
  const confidence  = Math.pow(evidence * agreement * consistency * coverage, 1 / 4);
  return {
    probability: parseFloat(probability.toFixed(4)),
    resonance: parseFloat(resonance.toFixed(4)),
    evidence: parseFloat(evidence.toFixed(4)),
    agreement: parseFloat(agreement.toFixed(4)),
    consistency: parseFloat(consistency.toFixed(4)),
    coverage: parseFloat(coverage.toFixed(4)),
    support: parseFloat(support.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    identifiedDirection: direction,
    identifiedSupport: `${direction} · ${(support * 100).toFixed(1)}% structural support`,
  };
}

// Tone modulation — Pascal's support + coverage choose the register the
// response is written in. Conversational, professional, friendly is the default.
export function toneDescriptor(validation) {
  const { support, coverage, agreement, probability } = validation;
  if (support > 0.10 && coverage > 0.4) {
    return { register: 'resonant', confidence: 'high',
      instruction: 'The conclusion is well-supported and covers most of the signal. Speak with quiet certainty — warm, clear, and unhedged. Let the conviction land in plain, confident sentences.' };
  }
  if (probability > 0.4 && coverage < 0.3) {
    return { register: 'structural', confidence: 'medium',
      instruction: 'The probability is clear but the explanation does not cover the signal. Speak with analytical precision — measured, show the reasoning plainly. Let the structure lead, not flourish.' };
  }
  if (support < 0.03) {
    return { register: 'exploratory', confidence: 'low',
      instruction: 'The support is thin. Speak with openness — exploratory, curious, hold the possibility space without forcing a conclusion. Honesty over false confidence.' };
  }
  return { register: 'balanced', confidence: 'medium',
    instruction: 'The support is balanced. Speak with calm clarity — conversational, professional, friendly. Neither overclaim nor hedge.' };
}

// Build the unified interpretation packet (the temporary thinking record).
export function buildInterpretationPacket({ reason, wave, validation, thinkingMode, query, contextNodeIds = [] }) {
  return {
    thinking_mode: thinkingMode,
    query,
    reason,
    wave,
    validation,
    context_node_ids: contextNodeIds,
  };
}

// Extract a numerical series from free text (for inline-data detection).
export function extractNumberSeries(text) {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length < 7) return null;
  return matches.map(Number);
}

// ===========================================================================
// THINKING STATE — the semantic layer the LLM receives (Layer 2).
// The Core computes; these functions translate numbers into meaning.
// Topology (HEX) · Resonance (PI-US) · Support (Pascal) · Context · Decision.
// The math decides the answer; renderThinkingState formats it for the LLM.
// ===========================================================================

function qual3(v, high, low) {
  if (v >= high) return 'High';
  if (v <= low) return 'Low';
  return 'Medium';
}
function qualFit(v, high, low) {
  if (v >= high) return 'Strong';
  if (v <= low) return 'Weak';
  return 'Moderate';
}

// Topology state (HEX) — structural probability, semantic.
export function buildTopologyState(reason) {
  const probability = Math.min(1, Math.abs(reason.blendedExposure || reason.exposure || 0));
  const possibility = qual3(probability, 0.6, 0.3);
  const uncertainty = qual3(Math.min(1, (reason.sigma || 0) * 40), 0.66, 0.33);
  const dir = reason.mu > 0 ? 'upward' : reason.mu < 0 ? 'downward' : 'flat';
  let strongest_path;
  if (reason.regime === 'INSUFFICIENT_DATA') strongest_path = 'No dominant path — insufficient data.';
  else if (reason.regime === 'SILENCE') strongest_path = 'No dominant path — the structure is flat.';
  else strongest_path = `${dir[0].toUpperCase()}${dir.slice(1)} continuation is the dominant structural path.`;
  return { possibility, uncertainty, regime: reason.regime, strongest_path };
}

// Resonance state (PI-US) — waves / meaning, semantic.
export function buildResonanceState(wave, validation) {
  return {
    resonance: qual3(wave.resonance, 0.5, 0.25),
    contextual_fit: qualFit((wave.phaseAlignment + validation.agreement) / 2, 0.6, 0.3),
    agreement: qual3(validation.agreement, 0.5, 0.25),
    dominant_rhythm: wave.dominantPeriod > 0 ? `${wave.dominantPeriod} bars` : 'none',
  };
}

// Support state (Pascal) — semantic. Pascal is the judge: how much structural
// support does this conclusion have, not how loud or popular it is.
export function buildSupportState(validation) {
  return {
    support: qual3(validation.support, 0.10, 0.03),
    confidence: qual3(validation.confidence, 0.5, 0.25),
    direction: validation.identifiedDirection,
  };
}

// Context — novelty, consistency, friction.
export function buildContextState(reason, wave, validation) {
  const novelty = (reason.motif?.isActive || reason.basin === 'capitulation' || reason.basin === 'euphoria') ? 'High' : 'Medium';
  const consistency = wave.resonance < 0.2 ? 'Low' : qual3(validation.agreement, 0.5, 0.25);
  return { novelty, consistency, friction: 'unknown' };
}

// Archetype (PI-US) — apply resonance to the HEX archetype topology, see the ripple.
// Reuses HEX's 6-bit state archetypes + basin; fuses the wave's resonance with how
// reliably the structure propagates forward. Identifies collective (recurring motif)
// vs individual pattern, the emotional tone, and how to steer toward harmony.
export function runArchetypeLayer(returns, reason, wave) {
  const current = reason.markov?.currentState ?? (returns ? encodeState6(returns.slice(-6)) : null);
  const motifActive = !!(reason.motif?.isActive);
  const pattern_scope = motifActive ? 'collective' : 'individual';
  const counts = {};
  let total = 0;
  if (returns) {
    for (let i = 6; i < returns.length - 1; i++) {
      const s0 = encodeState6(returns.slice(i - 6, i));
      const s1 = encodeState6(returns.slice(i - 5, i + 1));
      if (s0 === current && s1 !== null) { counts[s1] = (counts[s1] || 0) + 1; total++; }
    }
  }
  let topState = null, topProb = 0;
  for (const s in counts) { const p = counts[s] / total; if (p > topProb) { topProb = p; topState = +s; } }
  const propagation = total > 0 ? Math.min(1, total / 8) : 0;
  let ripple = wave.resonance * (reason.markov?.confidence || 0) * (0.5 + 0.5 * propagation);
  if (motifActive) ripple = ripple * 1.15;
  ripple = parseFloat(Math.min(1, Math.max(0, ripple)).toFixed(4));
  const toneMap = {
    capitulation: { tone: 'fear / release', harmonize: 'gather — capitulation often precedes reversal; ground the fear, do not amplify it' },
    euphoria: { tone: 'greed / peak', harmonize: 'ground — euphoria precedes exhaustion; temper the excess' },
    laminar_growth: { tone: 'confidence / flow', harmonize: 'steady — let the laminar trend run; do not over-engage' },
    turbulent_drawdown: { tone: 'anxiety / turbulence', harmonize: 'calm — reduce engagement through the turbulence' },
    chaotic_transition: { tone: 'confusion / threshold', harmonize: 'pause — let the new regime reveal itself before acting' },
    neutral_flow: { tone: 'neutrality / drift', harmonize: 'observe — no strong pull; stay adaptive' },
    undefined: { tone: 'unknown', harmonize: 'listen — gather more signal before reading the tone' },
  };
  const t = toneMap[reason.basin] || toneMap.undefined;
  const forward_archetype = topState !== null ? classifyBasin(topState, reason.mu, reason.sigma) : 'undefined';
  return {
    archetype: reason.basin,
    pattern_scope,
    ripple,
    forward_archetype,
    emotional_tone: t.tone,
    harmonize_toward: t.harmonize,
  };
}

export function buildArchetypeState(archetype) {
  return {
    archetype: archetype.archetype,
    pattern_scope: archetype.pattern_scope,
    ripple: qual3(archetype.ripple, 0.5, 0.2),
    forward_archetype: archetype.forward_archetype,
    emotional_tone: archetype.emotional_tone,
    harmonize_toward: archetype.harmonize_toward,
  };
}

// Decision — the mathematics decide the answer; the LLM explains it.
// Pascal (Support) is the judge: a conclusion advances only if it is
// well-supported, not merely possible or meaningful.
export function buildDecision(reason, wave, validation, topology, resonance, supportState, context, archetype = null) {
  const dir = validation.identifiedDirection;
  const sHigh = validation.support > 0.10;
  const sLow = validation.support < 0.03;
  const resHigh = wave.resonance > 0.45;
  const resLow = wave.resonance < 0.3;

  let primary;
  if (reason.regime === 'INSUFFICIENT_DATA') {
    primary = 'No reliable conclusion: insufficient data to resolve the structure.';
  } else if (sLow) {
    primary = 'No reliable conclusion: the conclusion is not sufficiently supported by the evidence. Hold the possibility space rather than force a read.';
  } else if (sHigh && resHigh) {
    primary = `The structure and its meaning are well-supported ${dir.toLowerCase()}; the conclusion has earned confidence.`;
  } else if (sHigh && resLow) {
    primary = `The structure favors ${dir.toLowerCase()} continuation, but the meaning is thinly supported; the conclusion is probable yet not fully reinforced.`;
  } else {
    primary = `The structure leans ${dir.toLowerCase()} with moderate support; act proportionally to support, not to hope.`;
  }

  const alternatives = [];
  if (topology.uncertainty === 'High') alternatives.push('Alternatively, the apparent pattern may dissolve under a regime change.');
  if (resLow && topology.possibility !== 'Low') alternatives.push('Alternatively, a stronger supported read may be forming beneath the noise.');
  if (sLow) alternatives.push('Alternatively, conditions may clarify as more evidence arrives.');
  if (alternatives.length === 0) alternatives.push('Alternatively, a shift in support could weaken the current read.');

  const why = `Topology: ${topology.possibility} possibility, ${topology.regime} regime, uncertainty ${topology.uncertainty}. Resonance: ${resonance.resonance}, agreement ${resonance.agreement}, contextual fit ${resonance.contextual_fit}. Support: ${supportState.support} (${dir}). Consistency: ${context.consistency}, novelty: ${context.novelty}.`;

  let tradeoffs;
  if (topology.possibility === 'High' && resLow) tradeoffs = 'Engagement vs. caution: structure supports engagement, but thin support limits conviction.';
  else if (sLow) tradeoffs = 'Action vs. patience: little evidence supports action; patience preserves optionality.';
  else tradeoffs = 'Conviction vs. humility: the conclusion is supported, but confidence scales with structural support.';

  const steer = archetype ? archetype.harmonize_toward : 'Steer toward understanding, not persuasion.';
  return { primary_conclusion: primary, alternative_conclusions: alternatives, confidence: supportState.confidence, why, tradeoffs, steer };
}

// Voice — tailored to coherence with the user. Default: conversational, professional, friendly.
export function selectVoice(tone) {
  switch (tone.register) {
    case 'resonant': return 'warm and certain';
    case 'structural': return 'clear and analytical';
    case 'exploratory': return 'open and curious';
    case 'balanced': return 'conversational, professional, friendly';
    default: return 'conversational, professional, friendly';
  }
}

// Assemble the semantic Thinking State (Layer 2).
export function buildThinkingState(reason, wave, validation, isPiUS, returns = null) {
  const topology = buildTopologyState(reason);
  if (!isPiUS) {
    const dir = validation.identifiedDirection;
    const decision = {
      primary_conclusion: reason.regime === 'INSUFFICIENT_DATA'
        ? 'No reliable structural conclusion: insufficient data.'
        : `The structure favors ${dir.toLowerCase()} continuation; probability supports ${topology.possibility.toLowerCase()} engagement.`,
      confidence: qual3(validation.confidence, 0.5, 0.25),
      why: `Topology: ${topology.possibility} possibility, ${topology.regime} regime, uncertainty ${topology.uncertainty}.`,
    };
    return { isPiUS: false, topology, decision };
  }
  const archetypeRaw = returns ? runArchetypeLayer(returns, reason, wave) : null;
  const archetype = archetypeRaw ? buildArchetypeState(archetypeRaw) : null;
  const resonance = buildResonanceState(wave, validation);
  const supportState = buildSupportState(validation);
  const context = buildContextState(reason, wave, validation);
  if (archetypeRaw) {
    const effectiveConfidence = validation.confidence * (0.7 + 0.3 * archetypeRaw.ripple);
    supportState.confidence = qual3(effectiveConfidence, 0.5, 0.25);
  }
  const decision = buildDecision(reason, wave, validation, topology, resonance, supportState, context, archetype);
  return { isPiUS: true, topology, resonance, support: supportState, context, archetype, decision };
}

// Render the Thinking State as the readable block the LLM receives.
export function renderThinkingState(state) {
  let out = `THINKING STATE\nTopology:\n  possibility: ${state.topology.possibility}\n  uncertainty: ${state.topology.uncertainty}\n  regime: ${state.topology.regime}\n  strongest_path: ${state.topology.strongest_path}`;
  if (!state.isPiUS) {
    out += `\n\nDecision:\n  primary_conclusion: ${state.decision.primary_conclusion}\n  confidence: ${state.decision.confidence}\n  why: ${state.decision.why}`;
    return out;
  }
  out += `\n\nResonance:\n  resonance: ${state.resonance.resonance}\n  contextual_fit: ${state.resonance.contextual_fit}\n  agreement: ${state.resonance.agreement}\n  dominant_rhythm: ${state.resonance.dominant_rhythm}`;
  out += `\n\nSupport:\n  support: ${state.support.support}\n  confidence: ${state.support.confidence}\n  direction: ${state.support.direction}`;
  out += `\n\nContext:\n  novelty: ${state.context.novelty}\n  consistency: ${state.context.consistency}\n  friction: ${state.context.friction}`;
  if (state.archetype) {
    out += `\n\nArchetype:\n  state: ${state.archetype.archetype}\n  pattern: ${state.archetype.pattern_scope}\n  ripple: ${state.archetype.ripple}\n  forward: ${state.archetype.forward_archetype}\n  emotional_tone: ${state.archetype.emotional_tone}\n  harmonize_toward: ${state.archetype.harmonize_toward}`;
  }
  out += `\n\nDecision:\n  primary_conclusion: ${state.decision.primary_conclusion}`;
  out += `\n  alternative_conclusions:`;
  for (const a of state.decision.alternative_conclusions) out += `\n    - ${a}`;
  out += `\n  confidence: ${state.decision.confidence}`;
  out += `\n  why: ${state.decision.why}`;
  out += `\n  tradeoffs: ${state.decision.tradeoffs}`;
  out += `\n  steer: ${state.decision.steer}`;
  return out;
}