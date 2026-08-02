// ===========================================================================
// ADAPTIVE RATIO GATE — the learn-and-test loop.
//
// The engine's only proven edge is the ratio gate: when |mu/sigma| is high,
// directional accuracy jumps to 58-60%; when low, it drops to 44-46%.
// This gate learns the ratio threshold per-asset from the recent walk-forward
// track record, and only commits directional calls when the engine has
// demonstrated edge. Otherwise it abstains (SILENCE).
//
// The loop: learn (walk-forward on recent window) → test (gate the current
// prediction) → learn (next prediction uses the updated window) → test → ...
// Each time new data arrives, the window shifts, the gate parameters update,
// and the engine's behavior adapts. No storage needed — the returns series
// IS the ground truth, and the walk-forward IS the resolution.
// ===========================================================================

import { runReasonLayer } from './thinkingEngine.ts';
import { fitScope, zeroShot } from './zeroScope.ts';

export interface GateState {
  ratioThreshold: number;    // median ratio — the learned separator
  highRatioAccuracy: number; // accuracy when ratio >= threshold
  lowRatioAccuracy: number;  // accuracy when ratio < threshold
  hasEdge: boolean;           // engine has demonstrated edge on this asset
  scopeAlpha: number;         // scope bias correction
  scopeBeta: number;          // scope scale correction
  sampleSize: number;
}

// Compute the gate state from a return series by running a quick walk-forward
// on the last `window` bars. This IS the learn step: the engine evaluates its
// own recent track record on this specific asset.
export function computeGateState(returns: number[], window = 30): GateState {
  const n = returns.length;
  if (n < window + 20) {
    return { ratioThreshold: 1.0, highRatioAccuracy: 0, lowRatioAccuracy: 0, hasEdge: false, scopeAlpha: 0, scopeBeta: 1, sampleSize: 0 };
  }
  const split = n - window;
  const calibPairs: { predictedMu: number; realized: number }[] = [];
  for (let j = 20; j < split; j++) {
    const r = runReasonLayer(returns.slice(0, j));
    calibPairs.push({ predictedMu: r.mu, realized: returns[j] });
  }
  const testResults: { ratio: number; predictedDir: number; actualDir: number }[] = [];
  for (let i = 0; i < window; i++) {
    const w = returns.slice(0, split + i);
    const reason = runReasonLayer(w);
    const ratio = reason.sigma > 1e-8 ? Math.abs(reason.mu / reason.sigma) : 0;
    const predictedDir = reason.mu > 0 ? 1 : reason.mu < 0 ? -1 : 0;
    const actualDir = returns[split + i] > 0 ? 1 : returns[split + i] < 0 ? -1 : 0;
    testResults.push({ ratio, predictedDir, actualDir });
    calibPairs.push({ predictedMu: reason.mu, realized: returns[split + i] });
  }
  const ratios = testResults.map(t => t.ratio).sort((a, b) => a - b);
  const threshold = ratios[Math.floor(ratios.length / 2)] || 1.0;
  const high = testResults.filter(t => t.ratio >= threshold && t.actualDir !== 0);
  const low = testResults.filter(t => t.ratio < threshold && t.actualDir !== 0);
  const highAcc = high.length ? high.filter(t => t.predictedDir === t.actualDir).length / high.length : 0;
  const lowAcc = low.length ? low.filter(t => t.predictedDir === t.actualDir).length / low.length : 0;
  const scope = fitScope(calibPairs);
  // Edge exists only when: enough samples, above-50% accuracy, AND meaningful
  // ratio separation (high - low > 3pp). Assets with no separation (NVDA,
  // TSLA) stay gated closed.
  const hasEdge = high.length >= 10 && highAcc > 0.50 && (highAcc - lowAcc) > 0.03;
  return {
    ratioThreshold: parseFloat(threshold.toFixed(4)),
    highRatioAccuracy: parseFloat(highAcc.toFixed(4)),
    lowRatioAccuracy: parseFloat(lowAcc.toFixed(4)),
    hasEdge,
    scopeAlpha: scope?.alpha ?? 0,
    scopeBeta: scope?.beta ?? 1,
    sampleSize: testResults.length,
  };
}

// Apply the gate to a new prediction. This IS the test step: should the
// engine commit a directional call, or express SILENCE?
export function applyGate(mu: number, sigma: number, gate: GateState) {
  const ratio = sigma > 1e-8 ? Math.abs(mu / sigma) : 0;
  const calibratedMu = gate.scopeAlpha + gate.scopeBeta * mu;
  const direction = calibratedMu > 0 ? 'UP' : calibratedMu < 0 ? 'DOWN' : 'FLAT';
  const commit = gate.hasEdge && ratio >= gate.ratioThreshold;
  return {
    commit,
    ratio: parseFloat(ratio.toFixed(4)),
    direction: commit ? direction : 'FLAT',
    calibratedMu: parseFloat(calibratedMu.toFixed(6)),
    conviction: commit ? gate.highRatioAccuracy : 0,
  };
}