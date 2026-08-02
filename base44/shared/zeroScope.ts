// ===========================================================================
// MAGNITUDE ZEROING LAYER — the sniper's scope.
//
// The engine knows WHICH WAY (direction, sign of mu) but not HOW FAR
// (magnitude). This layer zeros the scope: learns the linear mapping
// from internal conviction (mu) to actual return scale via rolling OLS.
//
//   calibrated_point = alpha + beta × mu
//
// Fit from the expanding window's own prediction-vs-reality history.
// No look-ahead: only pairs where the outcome is already known are used.
//
// The scope corrects two things:
//   alpha — bias (the engine's mu is systematically too high/low)
//   beta  — scale (mu is in the wrong units; beta rescales to basis points)
//
// When the engine has no magnitude signal (raw correlation ~ 0), beta
// collapses toward 0 and the scope defaults to the historical mean return
// (alpha) — honest SILENCE instead of a false magnitude call.
// ===========================================================================

export interface CalibrationPair {
  predictedMu: number;
  realized: number;
}

export interface ScopeCalibration {
  alpha: number;
  beta: number;
  n: number;
  inSampleR2: number;
}

// Fit alpha + beta via OLS: realized ≈ alpha + beta × mu
export function fitScope(pairs: CalibrationPair[]): ScopeCalibration | null {
  if (!pairs || pairs.length < 10) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p.predictedMu, 0) / n;
  const my = pairs.reduce((s, p) => s + p.realized, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pairs) {
    const dx = p.predictedMu - mx;
    const dy = p.realized - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx < 1e-14) return null;
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  const r2 = syy > 1e-14 ? Math.max(0, (sxy * sxy) / (sxx * syy)) : 0;
  return {
    alpha: parseFloat(alpha.toFixed(8)),
    beta: parseFloat(beta.toFixed(8)),
    n,
    inSampleR2: parseFloat(r2.toFixed(6)),
  };
}

// Apply the scope: calibrate raw mu to a predicted return point.
export function zeroShot(mu: number, scope: ScopeCalibration | null): number {
  if (!scope) return mu;
  return scope.alpha + scope.beta * mu;
}