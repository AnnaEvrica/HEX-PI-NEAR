// ===========================================================================
// CER — frequency. Welch coherence by band, and phase only where the band is
// coherent. A frequency or a phase is never reported from data that do not
// support it: too few segments give 'insufficient data', and a band that
// does not clear the no-relationship threshold gives 'not supported'.
// ===========================================================================
import type { Edge } from './types.ts';

/** Welch segment length (a power of two) and the bands, as periods in observations. */
export const SEG = 128;
export const BANDS: [number, number][] = [[2, 5], [5, 20], [20, 64]];
export const ALPHA = 0.05;

/** In-place radix-2 FFT. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2;
      const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
    }
  }
}

export type BandResult = Pick<Edge, 'band' | 'status' | 'coherence' | 'mean_coherence' | 'threshold' | 'segments' | 'frequencies' | 'period' | 'coherent' | 'phase' | 'neighbour_leads_by'>;

/**
 * Magnitude-squared coherence of two aligned series (a the target, b the
 * neighbour), by band: the highest coherence among the band's frequencies
 * against 1 - (alpha/m)^(1/(K-1)), m the number of frequencies in the band
 * and K the effective number of independent segments (0.947 per
 * half-overlapped Hann segment; Welch, 1967). Phase, and the lag it implies,
 * only where the band clears the threshold.
 */
export function coherence(a: number[], b: number[]): BandResult[] {
  const n = a.length, step = SEG / 2, cnt = n >= SEG ? Math.floor((n - SEG) / step) + 1 : 0, H = SEG / 2 + 1;
  if (cnt < 4) return BANDS.map((band) => ({ band, status: 'insufficient data' as const }));
  const w = Float64Array.from({ length: SEG }, (_, k) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / SEG));
  const Pxx = new Float64Array(H), Pyy = new Float64Array(H), Cr = new Float64Array(H), Ci = new Float64Array(H);
  const xr = new Float64Array(SEG), xi = new Float64Array(SEG), yr = new Float64Array(SEG), yi = new Float64Array(SEG);
  for (let s = 0; s < cnt; s++) {
    let mx = 0, my = 0;
    for (let k = 0; k < SEG; k++) { mx += a[s * step + k]; my += b[s * step + k]; }
    mx /= SEG; my /= SEG;
    for (let k = 0; k < SEG; k++) { xr[k] = (a[s * step + k] - mx) * w[k]; xi[k] = 0; yr[k] = (b[s * step + k] - my) * w[k]; yi[k] = 0; }
    fft(xr, xi); fft(yr, yi);
    for (let k = 0; k < H; k++) {
      Pxx[k] += xr[k] * xr[k] + xi[k] * xi[k]; Pyy[k] += yr[k] * yr[k] + yi[k] * yi[k];
      Cr[k] += xr[k] * yr[k] + xi[k] * yi[k]; Ci[k] += xi[k] * yr[k] - xr[k] * yi[k];          // X conj(Y)
    }
  }
  const keff = 0.947 * cnt, msc = (k: number) => (Pxx[k] > 0 && Pyy[k] > 0 ? (Cr[k] * Cr[k] + Ci[k] * Ci[k]) / (Pxx[k] * Pyy[k]) : 0);
  return BANDS.map((band) => {
    const ks: number[] = []; for (let k = 1; k < H; k++) if (band[0] <= SEG / k && SEG / k < band[1]) ks.push(k);
    const thr = 1 - (ALPHA / ks.length) ** (1 / (keff - 1));
    let best = ks[0], sum = 0; for (const k of ks) { sum += msc(k); if (msc(k) > msc(best)) best = k; }
    const c = msc(best), e: BandResult = { band, status: 'ok', coherence: c, mean_coherence: sum / ks.length, threshold: thr, segments: cnt, frequencies: ks.length, period: SEG / best, coherent: c > thr };
    if (c > thr) { const ph = Math.atan2(Ci[best], Cr[best]); e.phase = ph; e.neighbour_leads_by = -ph * SEG / (2 * Math.PI * best); }      // x(t) = y(t - tau)  =>  phase = -2 pi f tau
    else { e.phase = 'not supported'; e.neighbour_leads_by = 'not supported'; }
    return e;
  });
}
