// ===========================================================================
// GENETIC RISK ENGINE — per-I-Ching-hexagram risk aversion evolution.
//
// The I-Ching has 64 hexagrams (6-bit states 0-63). Each hexagram is a
// unique market state with its own energy. This engine maintains 64
// populations of risk-aversion genes — one per hexagram — and evolves them
// through a genetic algorithm: genes that produce better risk-adjusted
// returns in a given hexagram survive and mutate.
//
// When the engine is in hexagram state X, the dominant gene from population X
// becomes the live risk aversion. This replaces the fixed 2.5 (fractional
// Kelly) with an evolved, state-specific bet size.
//
// Each hexagram develops its own evolutionary lineage: fear hexagrams evolve
// cautious genes, growth hexagrams evolve aggressive genes, threshold
// hexagrams evolve patient genes. The I-Ching's 64 states are the ecosystems.
// ===========================================================================

const POP_SIZE = 12;
const EVOLUTION_FREQ = 20;
const MIN_VISITS = 8;
const MUTATION_RATE = 0.15;

interface Visit {
  muLb: number;
  sigma: number;
  actualReturn: number;
}

export class GeneticRiskEngine {
  private populations: number[][];
  private fitness: number[][];
  private memory: Visit[][];
  private barCount: number = 0;

  constructor() {
    this.populations = [];
    this.fitness = [];
    this.memory = [];
    for (let s = 0; s < 64; s++) {
      this.populations.push(Array.from({ length: POP_SIZE }, () => 1.0 + Math.random() * 4.0));
      this.fitness.push(new Array(POP_SIZE).fill(0));
      this.memory.push([]);
    }
  }

  // Get the dominant (top-3 average) risk aversion for a hexagram state.
  // Falls back to 2.5 (fractional Kelly) until enough visits accumulate.
  getDominantRA(hexagramState: number): number {
    if (hexagramState < 0 || hexagramState > 63) return 2.5;
    const mem = this.memory[hexagramState];
    if (mem.length < MIN_VISITS) return 2.5;
    const pop = this.populations[hexagramState];
    const fit = this.fitness[hexagramState];
    const idx = fit.map((f, i) => i).sort((a, b) => fit[b] - fit[a]);
    const top3 = idx.slice(0, 3).map(i => pop[i]);
    return top3.reduce((s, x) => s + x, 0) / 3;
  }

  // Record a visit to hexagram state with the engine's output and actual return.
  // Triggers evolution every EVOLUTION_FREQ bars.
  recordVisit(hexagramState: number, muLb: number, sigma: number, actualReturn: number): void {
    if (hexagramState < 0 || hexagramState > 63) return;
    this.memory[hexagramState].push({ muLb, sigma, actualReturn });
    if (this.memory[hexagramState].length > 252) {
      this.memory[hexagramState] = this.memory[hexagramState].slice(-252);
    }
    this.barCount++;
    if (this.barCount % EVOLUTION_FREQ === 0) {
      this.evolveAll();
    }
  }

  private evolveAll(): void {
    for (let s = 0; s < 64; s++) {
      const mem = this.memory[s];
      if (mem.length < MIN_VISITS) continue;
      const pop = this.populations[s];
      const fits = pop.map(ra => this.evaluateFitness(ra, mem));
      const idx = fits.map((f, i) => i).sort((a, b) => fits[b] - fits[a]);
      const survivors = idx.slice(0, POP_SIZE / 2).map(i => pop[i]);
      const offspring = survivors.map(ra =>
        Math.max(0.5, Math.min(8.0, ra * (1 + (Math.random() - 0.5) * 2 * MUTATION_RATE)))
      );
      this.populations[s] = [...survivors, ...offspring];
      this.fitness[s] = fits;
    }
  }

  // Fitness = Sharpe ratio - max drawdown penalty.
  // Simulates what would have happened if we used this RA for all visits
  // to this hexagram: exposure = clip(muLb / sigma² / RA, 0, 1).
  private evaluateFitness(ra: number, mem: Visit[]): number {
    const rets = mem.map(m => {
      if (m.sigma < 1e-8) return 0;
      const exposure = Math.min(1, Math.max(0, (m.muLb / (m.sigma * m.sigma)) / ra));
      return exposure * m.actualReturn;
    });
    const n = rets.length;
    const mean = rets.reduce((s, x) => s + x, 0) / n;
    const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    const vol = Math.sqrt(variance);
    if (vol < 1e-8) return -999;
    const sharpe = mean / vol;
    let cum = 1, peak = 1, mdd = 0;
    for (const r of rets) {
      cum *= (1 + r);
      peak = Math.max(peak, cum);
      mdd = Math.min(mdd, cum / peak - 1);
    }
    return sharpe + mdd * 0.5;
  }
}