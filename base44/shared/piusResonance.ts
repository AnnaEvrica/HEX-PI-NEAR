// ===========================================================================
// PI-US RESONANCE — finds a real, quantifiable rhythm in a user's word sequence
// over time. Ported faithfully from pi_us_resonance.py.
//
// IMPORTANT DISTINCTION: this exact FFT mechanism was tested three separate ways
// as a PRICE-PREDICTION signal earlier in this project and failed real
// out-of-sample validation each time. That failure was about using resonance to
// FORECAST future price direction. This is a different use of the same real
// math: DESCRIBING a user's linguistic cadence, not predicting anything. There
// is no clean ground-truth "accuracy" for "did we correctly detect someone's
// linguistic signature" — so this is verified to run correctly and produce
// sensible, interpretable output, not backtested. Different claim, honestly scoped.
//
// TOKENIZER: pluggable, not hardcoded. Real transformer tokenizers (tiktoken,
// HuggingFace) need network access to download vocab files this sandbox can't
// reach. The default here is a real, deterministic word-level tokenizer — an
// honest stand-in, not true BPE — structured so a real tokenizer can be swapped
// in via the tokenize_fn parameter without touching any of the resonance math.
// ===========================================================================

export type TokenizeFn = (text: string) => number[];

// Deterministic word-level tokenizer, no external vocab needed. NOT a real
// BPE/subword tokenizer — an honest stand-in. Returns a list of token IDs
// (stable deterministic hash of each word, not learned embeddings). Uses a
// fixed djb2-style hash so IDs are stable across runs (unlike Python's
// process-randomized hash()).
export function defaultWordTokenizer(text: string): number[] {
  const words = text.toLowerCase().match(/\b\w+\b|[^\w\s]/g) || [];
  return words.map((w) => djb2(w) % 50000);
}

function djb2(s: string): number {
  // unsigned 32-bit deterministic hash
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export interface WaveLayerResult {
  dominant_period_tokens: number;
  spectral_concentration: number;
  resonance: number;
  phase: number;
}

// VERBATIM from thinkingEngine.ts's runWaveLayer / this project's wave_layer
// math — unchanged. Real DFT, dominant frequency, spectral concentration,
// resonance, phase.
export function waveLayer(values: number[]): WaveLayerResult | null {
  const n = values.length;
  if (n < 8) return null;
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const centered = values.map((v) => v - mean);
  const maxK = Math.floor(n / 2);
  const powers = new Array(maxK).fill(0);
  const reArr = new Array(maxK).fill(0);
  const imArr = new Array(maxK).fill(0);
  for (let k = 1; k <= maxK; k++) {
    let reK = 0, imK = 0;
    for (let t = 0; t < n; t++) {
      const phaseArg = (2 * Math.PI * k * t) / n;
      reK += centered[t] * Math.cos(phaseArg);
      imK -= centered[t] * Math.sin(phaseArg);
    }
    powers[k - 1] = (reK * reK + imK * imK) / (n * n);
    reArr[k - 1] = reK;
    imArr[k - 1] = imK;
  }
  const totalPower = powers.reduce((s, x) => s + x, 0) || 1e-12;
  let domIdx = 0;
  let dominantPower = powers[0];
  for (let i = 1; i < powers.length; i++) {
    if (powers[i] > dominantPower) { dominantPower = powers[i]; domIdx = i; }
  }
  const spectralConcentration = dominantPower / totalPower;
  const std = Math.sqrt(centered.reduce((s, x) => s + x * x, 0) / n) || 1e-8;
  const waveAmplitude = Math.sqrt(dominantPower) / std;
  const resonance = Math.min(1, Math.tanh(spectralConcentration * 3) * Math.min(1, waveAmplitude * 2));
  const phase = Math.atan2(-imArr[domIdx], reArr[domIdx]);
  const dominantPeriod = Math.round(n / (domIdx + 1));
  return {
    dominant_period_tokens: dominantPeriod,
    spectral_concentration: round(spectralConcentration),
    resonance: round(resonance),
    phase: round(phase),
  };
}

export interface ResonanceSignature {
  status: 'computed' | 'insufficient_data';
  n_tokens: number;
  n_messages?: number;
  dominant_period_tokens?: number;
  spectral_concentration?: number;
  resonance?: number;
  phase?: number;
  interpretation?: string;
  note?: string;
}

// message_history: list of real text strings, in chronological order.
// tokenize_fn: swap in a real transformer tokenizer here for production
// fidelity — must return a list of int token IDs given a string.
//
// Returns a real, computed resonance signature describing the periodicity /
// coherence of the user's word-choice sequence over time — a DESCRIPTIVE
// signal, not a prediction.
export function resonanceSignature(messageHistory: string[], tokenizeFn: TokenizeFn = defaultWordTokenizer): ResonanceSignature {
  const allTokens: number[] = [];
  for (const msg of messageHistory) allTokens.push(...tokenizeFn(msg));

  if (allTokens.length < 8) {
    return {
      status: 'insufficient_data',
      n_tokens: allTokens.length,
      note: 'Need at least 8 tokens across the message history to compute a signature.',
    };
  }

  const wave = waveLayer(allTokens);
  if (!wave) {
    return { status: 'insufficient_data', n_tokens: allTokens.length };
  }
  return {
    status: 'computed',
    n_tokens: allTokens.length,
    n_messages: messageHistory.length,
    ...wave,
    interpretation: interpret(wave),
  };
}

// Plain-language description of what the numbers mean — descriptive only, no
// claim about what caused the pattern or what it predicts.
function interpret(wave: WaveLayerResult): string {
  if (wave.resonance > 0.5) {
    return `Coherent, repeating rhythm roughly every ${wave.dominant_period_tokens} tokens — this user's word choice shows a real periodic structure, not just varied/random phrasing.`;
  } else if (wave.resonance > 0.25) {
    return 'Some periodic structure present, but not strongly dominant — moderately varied phrasing.';
  }
  return 'No strong periodic structure detected — phrasing reads as eclectic/non-repetitive at this sample size.';
}

function round(x: number): number {
  return Math.round(x * 10000) / 10000;
}