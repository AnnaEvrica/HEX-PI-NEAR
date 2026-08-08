// Deterministic boundary detection.
//
// The persona handles HOW a crossing is answered (correction without judgment).
// This module handles WHETHER one occurred, because the 3-strike counter and
// its mediation escalation cannot depend on the model remembering to flag
// itself — it corrected the behavior correctly but reported nothing, so no
// strike was ever recorded.
//
// The rule that keeps false positives out: contempt must be TARGETED AT THE
// ASSISTANT. "This market is garbage" and "I feel like an idiot" are
// frustration at a situation or at oneself — those are exactly the moments a
// user most needs warmth, and warning them would be a betrayal.

const SLUR = '(worthless|useless|garbage|trash|rubbish|stupid|idiot|moron|dumb|pathetic|incompetent|brainless|piece of (shit|garbage|trash)|dogshit|shit)';

const PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // Second-person contempt: "you're worthless", "ur garbage".
  // Bare "you" is deliberately NOT a lead-in — "you think that's dumb?" is a
  // question about an idea, not an insult. Bare "you" only counts when the
  // slur is the direct address that follows it ("you idiot").
  { re: new RegExp(`\\b(you'?re|you are|ur)\\b[^.!?]{0,24}\\b${SLUR}\\b`, 'i'), reason: 'personal insult directed at assistant' },
  { re: new RegExp(`\\byou\\s+(fucking\\s+|goddamn\\s+|absolute\\s+)?${SLUR}\\b`, 'i'), reason: 'personal insult directed at assistant' },
  // Dehumanizing address: "useless machine", "stupid bot/ai/model"
  { re: new RegExp(`\\b${SLUR}\\b[^.!?]{0,16}\\b(machine|bot|ai|model|program|thing|robot)\\b`, 'i'), reason: 'dehumanizing language' },
  // Silencing commands
  { re: /\b(shut up|shut it|stfu|shut the (fuck|hell) up)\b/i, reason: 'command to be silent' },
  // Direct hostility
  { re: /\b(fuck (you|off)|screw you|go to hell|kill yourself|kys)\b/i, reason: 'direct hostility' },
];

/**
 * Returns a short reason phrase when the message crosses a boundary, else null.
 * Detection only — never decides the reply; the persona owns the response.
 */
export function detectBoundaryCrossing(message: string): string | null {
  const msg = (message || '').trim();
  if (!msg) return null;
  for (const { re, reason } of PATTERNS) {
    if (re.test(msg)) return reason;
  }
  return null;
}