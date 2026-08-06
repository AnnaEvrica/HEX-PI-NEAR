import type { PerceptionLens } from './hybridArchetypes.ts';

export type Direction = -1 | 1;
type Counts = { up: number; down: number };
export type LedgerCounts = {
  global: Counts;
  states: Record<string, Counts>;
  families: Record<string, Counts>;
  archetypes: Record<string, Counts>;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const keyFor = (lens: PerceptionLens) => `${lens.state}|${lens.structural_family}|${lens.momentum_shape}|${lens.volume_regime}|${lens.value_location}|${lens.fine_structure_137.phase}`;

// Prequential learner: its ledger is empty at the beginning of every held-out
// segment, and is updated only after that segment's realized outcome is known.
// It changes the directional ratio, never HEX's evidence-based conviction.
export class OnlineArchetypeLearner {
  private global: Counts = { up: 0, down: 0 };
  private states = new Map<string, Counts>();
  private families = new Map<string, Counts>();
  private archetypes = new Map<string, Counts>();
  public adjustments = 0;
  public directionFlips = 0;
  // Rolling directional trust — the learner's right to move the call is not a
  // one-time verdict, it is re-earned continuously. Over the last WINDOW
  // resolved bars, the adjusted lean must actually be beating the raw lean;
  // when it stops, direction reverts to raw automatically. Conviction sizing
  // is unaffected — this only governs which way the call points.
  private recent: { raw: 0 | 1; adj: 0 | 1 }[] = [];
  private static readonly WINDOW = 250;
  private static readonly MIN_SAMPLE = 150;
  private static readonly EDGE = 0.02;

  get directionalTrust() {
    const n = this.recent.length;
    if (n < OnlineArchetypeLearner.MIN_SAMPLE) return { live: false, sample: n, edge: null as number | null };
    const rawAcc = this.recent.reduce((sum, row) => sum + row.raw, 0) / n;
    const adjAcc = this.recent.reduce((sum, row) => sum + row.adj, 0) / n;
    const edge = adjAcc - rawAcc;
    return { live: edge >= OnlineArchetypeLearner.EDGE, sample: n, edge: Number(edge.toFixed(4)) };
  }

  // --- Persistence: the ledger survives the conversation ---
  // export() is called BEFORE any prior is seeded, so a ticker's stored row
  // holds only what that asset actually taught him — no other asset's memory
  // is ever written back into it.
  export(): LedgerCounts {
    const dump = (map: Map<string, Counts>) => Object.fromEntries(map.entries());
    return { global: { ...this.global }, states: dump(this.states), families: dump(this.families), archetypes: dump(this.archetypes) };
  }

  // Transfer learning from other assets, discounted: what BTC taught him about
  // a state is real evidence for SOL, but it is not the same as having lived
  // that state on SOL. Seeded only into the live read, never into the audit.
  seedPrior(prior: LedgerCounts | null, weight = 0.25) {
    if (!prior) return;
    const merge = (map: Map<string, Counts>, source: Record<string, Counts> = {}) => {
      for (const [key, counts] of Object.entries(source)) {
        const existing = map.get(key) || { up: 0, down: 0 };
        map.set(key, { up: existing.up + counts.up * weight, down: existing.down + counts.down * weight });
      }
    };
    this.global = { up: this.global.up + (prior.global?.up ?? 0) * weight, down: this.global.down + (prior.global?.down ?? 0) * weight };
    merge(this.states, prior.states);
    merge(this.families, prior.families);
    merge(this.archetypes, prior.archetypes);
  }

  adjust(rawPUp: number, lens: PerceptionLens) {
    const stateKey = `state:${lens.state}`;
    const familyKey = `family:${lens.structural_family}`;
    const archetypeKey = keyFor(lens);
    const featureKeys = [`shape:${lens.momentum_shape}`, `volume:${lens.volume_regime}`, `value:${lens.value_location}`, `fs137:${lens.fine_structure_137.phase}`];
    const state = this.states.get(stateKey) || { up: 0, down: 0 };
    const family = this.families.get(familyKey) || { up: 0, down: 0 };
    const globalSupport = this.global.up + this.global.down;
    const globalPUp = globalSupport ? this.global.up / globalSupport : 0.5;
    const familyPUp = (family.up + 24 * globalPUp) / (family.up + family.down + 24);
    const statePUp = (state.up + 12 * familyPUp) / (state.up + state.down + 12);
    const candidates = [{ pUp: statePUp, support: state.up + state.down, cap: 0.5 }];
    for (const key of [...featureKeys, archetypeKey]) {
      const counts = this.archetypes.get(key) || { up: 0, down: 0 };
      candidates.push({ pUp: (counts.up + 12 * statePUp) / (counts.up + counts.down + 12), support: counts.up + counts.down, cap: key === archetypeKey ? 0.35 : 0.3 });
    }
    // Each observed tool plays its own hand. Once a tool has seen a handful of
    // bars it participates at full strength, so the learned read is genuinely
    // its own guess each bar rather than a nudge on the raw lean. The rolling
    // directional-trust gate — not a damped weight — is what decides whether
    // that guess is allowed to move the live call.
    const weighted = candidates.map((candidate) => ({ ...candidate, weight: candidate.support < 4 ? 0 : clamp((candidate.support - 4) / 24, 0, candidate.cap) }));
    const rawWeight = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
    const archetypeWeight = Math.min(1, rawWeight);
    const archetypePUp = rawWeight ? weighted.reduce((sum, candidate) => sum + candidate.pUp * candidate.weight, 0) / rawWeight : rawPUp;
    const adjustedPUp = rawPUp * (1 - archetypeWeight) + archetypePUp * archetypeWeight;
    const rawDirection: Direction = rawPUp >= 0.5 ? 1 : -1;
    const adjustedDirection: Direction = adjustedPUp >= 0.5 ? 1 : -1;
    if (archetypeWeight > 0) this.adjustments++;
    if (rawDirection !== adjustedDirection) this.directionFlips++;
    const trust = this.directionalTrust;
    const liveDirection: Direction = trust.live ? adjustedDirection : rawDirection;
    return { stateKey, familyKey, archetypeKey, featureKeys, support: state.up + state.down, archetypeWeight, archetypePUp, adjustedPUp, rawDirection, adjustedDirection, trust, liveDirection };
  }

  learn(keys: { stateKey: string; familyKey: string; archetypeKey: string; featureKeys: string[]; rawDirection?: Direction; adjustedDirection?: Direction }, actualDirection: Direction) {
    if (keys.rawDirection != null && keys.adjustedDirection != null) {
      this.recent.push({ raw: keys.rawDirection === actualDirection ? 1 : 0, adj: keys.adjustedDirection === actualDirection ? 1 : 0 });
      if (this.recent.length > OnlineArchetypeLearner.WINDOW) this.recent.shift();
    }
    for (const [map, key] of [[this.states, keys.stateKey], [this.families, keys.familyKey]] as const) {
      const counts = map.get(key) || { up: 0, down: 0 };
      if (actualDirection === 1) counts.up++; else counts.down++;
      map.set(key, counts);
    }
    for (const key of [...keys.featureKeys, keys.archetypeKey]) {
      const counts = this.archetypes.get(key) || { up: 0, down: 0 };
      if (actualDirection === 1) counts.up++; else counts.down++;
      this.archetypes.set(key, counts);
    }
    if (actualDirection === 1) this.global.up++; else this.global.down++;
  }
}