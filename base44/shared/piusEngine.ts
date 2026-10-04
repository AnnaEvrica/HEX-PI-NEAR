// ===========================================================================
// PI-US — voice. Takes the probability read and decides HOW it should be
// spoken about: the register, and the person's cadence. It makes no numbers
// of its own and never raises or lowers a probability.
//
// Probability and statistics only: this layer never tells the language model
// to express confidence, conviction or strength of call. The number and its
// distance from the usual odds carry the weight.
// ===========================================================================

import { probabilityBlock, type ProbabilityRead } from './probabilityRead.ts';
import type { ResonanceSignature } from './piusResonance.ts';

export type PiUsRegister = 'resonant' | 'structural' | 'balanced' | 'exploratory';

export interface PiUsResult {
  register: PiUsRegister;
  /** True when the read has 200+ scored steps on this series behind it. */
  well_supported: boolean;
  directive: string;
}

/** A read this many points from its usual odds is spoken about as a clear departure. */
const CLEAR_DEPARTURE = 0.05;

export function calibrate(
  read: ProbabilityRead | null,
  resonance?: ResonanceSignature | null,
  label = 'this series',
): PiUsResult {
  let register: PiUsRegister;
  let registerInstruction: string;

  if (!read) {
    register = 'exploratory';
    registerInstruction = 'There is no probability for this series. Say so in one plain line and work from the supplied facts.';
  } else if (!read.prob.calibrated) {
    register = 'structural';
    registerInstruction = 'The read is early: it has fewer than 200 scored steps behind it. Give the numbers beside their usual odds and say in the same breath that the record on this series is still short.';
  } else if (read.direction_at_base && read.size_at_base) {
    register = 'exploratory';
    registerInstruction = 'Both numbers sit at their usual odds. Say that plainly — nothing is leaning right now — and name the level or event that would change it. Do not manufacture a call.';
  } else if (Math.max(Math.abs(read.edge_up), Math.abs(read.edge_big)) >= CLEAR_DEPARTURE) {
    register = 'resonant';
    registerInstruction = 'One of the numbers departs clearly from its usual odds. Lead with that number and its usual odds, stated flatly, then what would confirm or break it.';
  } else {
    register = 'balanced';
    registerInstruction = 'The departure from the usual odds is modest. State the number, its usual odds, and the size of the gap; let the size of the gap do the talking.';
  }

  let cadenceNote = '';
  if (resonance && resonance.status === 'computed' && typeof resonance.resonance === 'number') {
    const r = resonance.resonance;
    const period = resonance.dominant_period_tokens;
    if (r > 0.5) {
      cadenceNote = ` This person's phrasing has a steady rhythm (repeating roughly every ${period} tokens); matching it lightly may read as more attuned.`;
    } else if (r < 0.2) {
      cadenceNote = ` This person's phrasing is varied; there is no cadence to match.`;
    }
  }

  const directive =
    `(Internal directive — do not describe this process or narrate it to the reader.)\n` +
    `${probabilityBlock(read, label)}\n` +
    `REGISTER: ${register}. ${registerInstruction}${cadenceNote}`;

  return { register, well_supported: !!read?.prob.calibrated, directive };
}
