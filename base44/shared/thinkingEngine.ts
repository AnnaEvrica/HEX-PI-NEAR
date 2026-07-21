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

// Pascal value fusion — probability × resonance × coherence.
// Coherence = how well the structural probability and the wave resonance agree.
export function runValueLayer(reasonResult, waveResult) {
  const probability = Math.min(1, Math.abs(reasonResult.blendedExposure || reasonResult.exposure || 0));
  const resonance = waveResult.resonance || 0;
  const coherence = Math.min(1, Math.sqrt(probability * resonance));
  const value = probability * resonance * coherence;
  const direction = reasonResult.mu > 0 ? 'UP' : reasonResult.mu < 0 ? 'DOWN' : 'FLAT';
  // Overall confidence: geometric mean of the three signals
  const confidence = Math.cbrt(probability * resonance * coherence);
  return {
    probability: parseFloat(probability.toFixed(4)),
    resonance: parseFloat(resonance.toFixed(4)),
    coherence: parseFloat(coherence.toFixed(4)),
    value: parseFloat(value.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    identifiedDirection: direction,
    identifiedValue: `${direction} · ${(value * 100).toFixed(1)}% value conviction`,
  };
}

// Tone modulation — PI-US value/resonance feeds back to modulate the response tone.
// This is the "feed back to HEX6-BLE and adjust tone" step: the value layer's
// output chooses the register the response is written in.
export function toneDescriptor(valueLayer) {
  const { value, resonance, probability, coherence } = valueLayer;
  if (value > 0.12 && resonance > 0.45) {
    return { register: 'resonant', confidence: 'high',
      instruction: 'The signal is resonant and high-value. Speak with quiet certainty — poetic, decisive, unhedged. Let the conviction land in short lyrical sentences. The waves are coherent; trust them.' };
  }
  if (probability > 0.4 && resonance < 0.3) {
    return { register: 'structural', confidence: 'medium',
      instruction: 'The probability is clear but the waves are incoherent. Speak with analytical precision — structural, measured, show the scaffolding. Let the math lead, not the poetry.' };
  }
  if (value < 0.04) {
    return { register: 'exploratory', confidence: 'low',
      instruction: 'The signal is weak and the waves are diffuse. Speak with openness — exploratory, curious, hold the possibility space without forcing a conclusion. Honesty over false confidence.' };
  }
  return { register: 'balanced', confidence: 'medium',
    instruction: 'The signal is balanced. Speak with calm clarity — neither overclaiming nor hedging. Let both the probability and the resonance show through.' };
}

// Build the unified interpretation packet (the temporary thinking record).
export function buildInterpretationPacket({ reason, wave, value, thinkingMode, query, contextNodeIds = [] }) {
  return {
    thinking_mode: thinkingMode,
    query,
    reason,
    wave,
    value,
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
// Topology (HEX) · Resonance (PI-US) · Value (Pascal) · Context · Decision.
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
export function buildResonanceState(wave, value) {
  return {
    resonance: qual3(wave.resonance, 0.5, 0.25),
    contextual_fit: qualFit((wave.phaseAlignment + value.coherence) / 2, 0.6, 0.3),
    coherence: qual3(value.coherence, 0.5, 0.25),
    dominant_rhythm: wave.dominantPeriod > 0 ? `${wave.dominantPeriod} bars` : 'none',
  };
}

// Value state (Pascal) — semantic.
export function buildValueState(value) {
  return {
    value: qual3(value.value, 0.12, 0.04),
    confidence: qual3(value.confidence, 0.5, 0.25),
    direction: value.identifiedDirection,
  };
}

// Context — novelty, consistency, friction.
export function buildContextState(reason, wave, value) {
  const novelty = (reason.motif?.isActive || reason.basin === 'capitulation' || reason.basin === 'euphoria') ? 'High' : 'Medium';
  const consistency = wave.resonance < 0.2 ? 'Low' : qual3(value.coherence, 0.5, 0.25);
  return { novelty, consistency, friction: 'unknown' };
}

// Decision — the mathematics decide the answer; the LLM explains it.
export function buildDecision(reason, wave, value, topology, resonance, valueState, context) {
  const dir = value.identifiedDirection;
  const vHigh = value.value > 0.12;
  const vLow = value.value < 0.04;
  const resHigh = wave.resonance > 0.45;
  const resLow = wave.resonance < 0.3;

  let primary;
  if (reason.regime === 'INSUFFICIENT_DATA') {
    primary = 'No reliable conclusion: insufficient data to resolve the structure.';
  } else if (vLow) {
    primary = 'No reliable conclusion: the signal is weak and incoherent. Hold the possibility space rather than force a read.';
  } else if (vHigh && resHigh) {
    primary = `The structure and its waves align ${dir.toLowerCase()}; engagement is supported with coherent conviction.`;
  } else if (vHigh && resLow) {
    primary = `The structure favors ${dir.toLowerCase()} continuation, but the waves are incoherent; engagement is probable yet not resonant.`;
  } else {
    primary = `The structure leans ${dir.toLowerCase()} with moderate conviction; act proportionally to coherence, not to hope.`;
  }

  const alternatives = [];
  if (topology.uncertainty === 'High') alternatives.push('Alternatively, the apparent pattern may dissolve under a regime change.');
  if (resLow && topology.possibility !== 'Low') alternatives.push('Alternatively, a stronger coherent wave may be forming beneath the noise.');
  if (vLow) alternatives.push('Alternatively, conditions may clarify as more data arrives.');
  if (alternatives.length === 0) alternatives.push('Alternatively, a shift in resonance could weaken the current read.');

  const why = `Topology: ${topology.possibility} possibility, ${topology.regime} regime, uncertainty ${topology.uncertainty}. Resonance: ${resonance.resonance}, coherence ${resonance.coherence}, contextual fit ${resonance.contextual_fit}. Value: ${valueState.value} (${dir}). Consistency: ${context.consistency}, novelty: ${context.novelty}.`;

  let tradeoffs;
  if (topology.possibility === 'High' && resLow) tradeoffs = 'Engagement vs. caution: structure supports engagement, but thin resonance limits conviction.';
  else if (vLow) tradeoffs = 'Action vs. patience: little evidence supports action; patience preserves optionality.';
  else tradeoffs = 'Conviction vs. humility: the signal supports a read, but confidence scales with coherence.';

  return { primary_conclusion: primary, alternative_conclusions: alternatives, confidence: valueState.confidence, why, tradeoffs };
}

// Voice — tailored to coherence with the user. Default: friendly yet professional.
export function selectVoice(tone) {
  switch (tone.register) {
    case 'resonant': return 'poetic';
    case 'structural': return 'scientific';
    case 'exploratory': return 'minimal';
    case 'balanced': return 'teacher';
    default: return 'friendly yet professional';
  }
}

// Assemble the semantic Thinking State (Layer 2).
export function buildThinkingState(reason, wave, value, isPiUS) {
  const topology = buildTopologyState(reason);
  if (!isPiUS) {
    const dir = value.identifiedDirection;
    const decision = {
      primary_conclusion: reason.regime === 'INSUFFICIENT_DATA'
        ? 'No reliable structural conclusion: insufficient data.'
        : `The structure favors ${dir.toLowerCase()} continuation; probability supports ${topology.possibility.toLowerCase()} engagement.`,
      confidence: qual3(value.confidence, 0.5, 0.25),
      why: `Topology: ${topology.possibility} possibility, ${topology.regime} regime, uncertainty ${topology.uncertainty}.`,
    };
    return { isPiUS: false, topology, decision };
  }
  const resonance = buildResonanceState(wave, value);
  const valueState = buildValueState(value);
  const context = buildContextState(reason, wave, value);
  const decision = buildDecision(reason, wave, value, topology, resonance, valueState, context);
  return { isPiUS: true, topology, resonance, value: valueState, context, decision };
}

// Render the Thinking State as the readable block the LLM receives.
export function renderThinkingState(state) {
  let out = `THINKING STATE\nTopology:\n  possibility: ${state.topology.possibility}\n  uncertainty: ${state.topology.uncertainty}\n  regime: ${state.topology.regime}\n  strongest_path: ${state.topology.strongest_path}`;
  if (!state.isPiUS) {
    out += `\n\nDecision:\n  primary_conclusion: ${state.decision.primary_conclusion}\n  confidence: ${state.decision.confidence}\n  why: ${state.decision.why}`;
    return out;
  }
  out += `\n\nResonance:\n  resonance: ${state.resonance.resonance}\n  contextual_fit: ${state.resonance.contextual_fit}\n  coherence: ${state.resonance.coherence}\n  dominant_rhythm: ${state.resonance.dominant_rhythm}`;
  out += `\n\nValue:\n  value: ${state.value.value}\n  confidence: ${state.value.confidence}\n  direction: ${state.value.direction}`;
  out += `\n\nContext:\n  novelty: ${state.context.novelty}\n  consistency: ${state.context.consistency}\n  friction: ${state.context.friction}`;
  out += `\n\nDecision:\n  primary_conclusion: ${state.decision.primary_conclusion}`;
  out += `\n  alternative_conclusions:`;
  for (const a of state.decision.alternative_conclusions) out += `\n    - ${a}`;
  out += `\n  confidence: ${state.decision.confidence}`;
  out += `\n  why: ${state.decision.why}`;
  out += `\n  tradeoffs: ${state.decision.tradeoffs}`;
  return out;
}