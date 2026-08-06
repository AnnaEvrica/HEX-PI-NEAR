import type { PerceptionLens } from './hybridArchetypes.ts';

export type Direction = -1 | 1;
type Counts = { up: number; down: number };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const keyFor = (lens: PerceptionLens) => `${lens.state}|${lens.structural_family}|${lens.momentum_shape}`;

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
    const state = this.states.get(stateKey) || { up: 0, down: 0 };
    const family = this.families.get(familyKey) || { up: 0, down: 0 };
    const support = state.up + state.down;
    const globalSupport = this.global.up + this.global.down;
    const globalPUp = globalSupport ? this.global.up / globalSupport : 0.5;
    // Hierarchical grounding: the broad structural family supplies a stable
    // prior, then the current HEX grid state earns its own influence as it
    // repeats. The fully specific archetype is still recorded on every update.
    const familyPUp = (family.up + 24 * globalPUp) / (family.up + family.down + 24);
    const archetypePUp = (state.up + 12 * familyPUp) / (support + 12);
    const archetypeWeight = support < 12 ? 0 : clamp((support - 12) / 96, 0, 0.35);
    const adjustedPUp = rawPUp * (1 - archetypeWeight) + archetypePUp * archetypeWeight;
    const rawDirection: Direction = rawPUp >= 0.5 ? 1 : -1;
    const adjustedDirection: Direction = adjustedPUp >= 0.5 ? 1 : -1;
    if (archetypeWeight > 0) this.adjustments++;
    if (rawDirection !== adjustedDirection) this.directionFlips++;
    return { stateKey, familyKey, archetypeKey, support, archetypeWeight, archetypePUp, adjustedPUp, rawDirection, adjustedDirection };
  }

  learn(keys: { stateKey: string; familyKey: string; archetypeKey: string }, actualDirection: Direction) {
    for (const [map, key] of [[this.states, keys.stateKey], [this.families, keys.familyKey], [this.archetypes, keys.archetypeKey]] as const) {
      const counts = map.get(key) || { up: 0, down: 0 };
      if (actualDirection === 1) counts.up++; else counts.down++;
      map.set(key, counts);
    }
    if (actualDirection === 1) this.global.up++; else this.global.down++;
  }
}