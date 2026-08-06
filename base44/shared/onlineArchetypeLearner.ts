import type { PerceptionLens } from './hybridArchetypes.ts';

export type Direction = -1 | 1;
type Counts = { up: number; down: number };

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
    const candidates = [{ pUp: statePUp, support: state.up + state.down, cap: 0.16 }];
    for (const key of [...featureKeys, archetypeKey]) {
      const counts = this.archetypes.get(key) || { up: 0, down: 0 };
      candidates.push({ pUp: (counts.up + 12 * statePUp) / (counts.up + counts.down + 12), support: counts.up + counts.down, cap: key === archetypeKey ? 0.06 : 0.08 });
    }
    // Each tool earns a bounded influence independently. Broad, repeated
    // observations can participate; a rare composite remains a small vote.
    const weighted = candidates.map((candidate) => ({ ...candidate, weight: candidate.support < 12 ? 0 : clamp((candidate.support - 12) / 96, 0, candidate.cap) }));
    const rawWeight = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
    const archetypeWeight = Math.min(0.35, rawWeight);
    const archetypePUp = rawWeight ? weighted.reduce((sum, candidate) => sum + candidate.pUp * candidate.weight, 0) / rawWeight : rawPUp;
    const adjustedPUp = rawPUp * (1 - archetypeWeight) + archetypePUp * archetypeWeight;
    const rawDirection: Direction = rawPUp >= 0.5 ? 1 : -1;
    const adjustedDirection: Direction = adjustedPUp >= 0.5 ? 1 : -1;
    if (archetypeWeight > 0) this.adjustments++;
    if (rawDirection !== adjustedDirection) this.directionFlips++;
    return { stateKey, familyKey, archetypeKey, featureKeys, support: state.up + state.down, archetypeWeight, archetypePUp, adjustedPUp, rawDirection, adjustedDirection };
  }

  learn(keys: { stateKey: string; familyKey: string; archetypeKey: string; featureKeys: string[] }, actualDirection: Direction) {
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