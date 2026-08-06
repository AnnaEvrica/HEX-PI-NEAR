// ===========================================================================
// NOVELTY ENGINE — the anti-attractor layer.
//
// THE PROBLEM: an LLM asked to "be original" regresses to a modal register.
// Given a fixed persona and a fixed prompt shape, it re-enters every reply the
// same way ("Here's the honest picture"), builds every reply the same way
// (antithesis: "That's not weakness — that's X"), and closes every reply the
// same way. The persona was being embodied faithfully; the SAMPLING was the
// problem, not the character.
//
// THE FIX: perturb the *approach*, never the *content*. Each turn receives a
// deterministic-but-varying vector — how to enter, how to build, what texture
// to use — derived from a hash of the message itself, plus an explicit ban on
// the openers this model actually used in its own recent replies. The truth
// being delivered is untouched; only the path into it moves.
//
// COST: zero additional LLM calls. Pure string computation, ~120 tokens on the
// prompt. Novelty at effectively no credit cost.
//
// CONSTRAINT ORDER (non-negotiable, restated in the directive itself):
// accuracy > usefulness > novelty. A fresh angle that bends a number or
// invents a claim is a failure, not a flourish. Novelty is the *route*; truth
// is the destination, and the destination never moves.
// ===========================================================================

// FNV-1a — stable, fast, well-distributed across small string changes so two
// similar messages still land on different approach vectors.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// HOW THE REPLY ENTERS. The first sentence is where sameness is most visible
// and most damaging — it's the handshake. Never the same handshake twice.
const ENTRIES = [
  'enter on a concrete detail from their own message — the smallest specific thing they said, held up close',
  'enter mid-thought, as though you were already thinking about this before they asked',
  'enter by answering the actual question in the first sentence, then earn it in the rest',
  'enter with the one thing that surprised you about what they said',
  'enter quietly — a short, plain sentence that carries weight because it refuses to perform',
  'enter by naming what they did NOT say, the shape of the absence',
  'enter with a single image or comparison drawn from their own world, not yours',
  'enter on the second-most-obvious point, because the most obvious one is already in their head',
  'enter with an admission — what you can and cannot see from here',
  'enter by disagreeing with the premise, gently, before anything else',
  'enter on the timeline — where this sits in a longer arc than the one they framed',
  'enter with the counterexample that complicates the easy read',
];

// HOW THE REPLY IS BUILT. Rotating the architecture breaks the antithesis
// reflex ("not X — it's Y") that makes every reply structurally identical.
const SHAPES = [
  'build it as a single unbroken thought that arrives somewhere they did not expect',
  'build it as observation, then complication, then a resting place that is not a conclusion',
  'build it narrow to wide — the specific thing first, the system it belongs to second',
  'build it wide to narrow — the shape of the whole, then the one detail that decides it',
  'build it as two short paragraphs where the second one turns on the first',
  'build it as a question you answer yourself, then leave slightly open',
  'build it as a plain statement followed by the reason it is harder than it sounds',
  'build it as one long sentence and one very short one',
  'build it by starting where most people stop',
  'build it as a correction of the frame, then the answer inside the corrected frame',
];

// TEXTURE — the lexical dial. Prevents the register itself from flattening.
const TEXTURES = [
  'plain words, short sentences, no ornament — let the accuracy be the style',
  'one vivid concrete image, everything else stripped bare',
  'dry and deadpan; the humor is in the timing, not in a joke',
  'warm and unhurried, sentences with room to breathe',
  'clipped and precise, verbs doing all the work',
  'conversational and slightly wry, like thinking out loud with someone you respect',
  'measured and serious, no lightness — the moment does not have room for it',
  'curious and forward-leaning, more interested in them than in being right',
];

// The specific fingerprints of generic model output. These are the phrases
// that make an answer feel machine-written regardless of how good it is.
const BANNED_TELLS = [
  "Here's the honest picture", "Here's the thing", "Let's be clear", "The truth is",
  "The part that strikes me", "What strikes me", "It's worth noting", "At the end of the day",
  "That's not X, that's Y", "isn't weakness, it's", "not a bug, it's a feature",
  "I hear you", "That sounds really hard", "You're not alone in this",
  "Let me break this down", "In essence", "Ultimately", "genuinely cruel", "genuinely",
];

/**
 * Build the per-turn novelty directive.
 *
 * @param message   the user's current message (drives the hash)
 * @param history   full conversation history (recent assistant openers get banned)
 * @param weighted  true when the turn carries emotional weight — novelty must
 *                  never cost warmth, so the texture is constrained to the
 *                  human registers rather than the dry/clipped ones.
 */
// Light social turns — greetings, acknowledgments, quick thanks. Routing one
// of these through an approach vector ("name the shape of the absence") makes
// the model manufacture cryptic depth out of a two-word hello. These turns
// get NO vector: just answer like a person.
const LIGHT_TURN = /^(hi+|hey+|hello+|yo|sup|howdy|gm|gn|good (morning|evening|night|afternoon)|what'?s up|how are you|how'?s it going|thanks?|thank you|thx|ok(ay)?|cool|nice|sure|sounds good|got it|lol|haha|bye|goodbye|later)\b[\s\S]{0,30}$/i;

export function noveltyDirective(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  weighted = false,
): string {
  if (LIGHT_TURN.test(message.trim())) {
    return `APPROACH: This is a light social turn — a greeting or quick acknowledgment. Do not manufacture depth, mystery, or analysis out of it. Answer the way a warm, quick person actually would: one short, natural, plainly worded line. Nothing cryptic, nothing performed. Never say their name back to them.`;
  }

  // Hash on the message plus turn depth so a repeated question later in a
  // conversation still gets a different route than it did the first time.
  const seed = hash(`${message}::${history.length}`);

  const entry = ENTRIES[seed % ENTRIES.length];
  const shape = SHAPES[Math.floor(seed / ENTRIES.length) % SHAPES.length];
  // Weighted turns draw only from the human end of the texture pool — a
  // grieving person should never get "clipped and precise" because a hash
  // said so. Novelty bends to care, not the other way around.
  const pool = weighted ? TEXTURES.filter((_, i) => [3, 5, 6, 7].includes(i)) : TEXTURES;
  const texture = pool[Math.floor(seed / (ENTRIES.length * SHAPES.length)) % pool.length];

  // Self-repetition ban: the model's own recent openings, verbatim. This is
  // the highest-signal novelty lever available and it costs nothing — the
  // history is already in the payload.
  const recentOpeners = history
    .filter((m) => m.role !== 'user' && typeof m.content === 'string')
    .slice(-5)
    .map((m) => m.content.trim().split(/(?<=[.!?])\s/)[0].slice(0, 70))
    .filter(Boolean);

  const openerBan = recentOpeners.length
    ? `\n  You already opened recent replies with these — do not reuse them or any close variant:\n    ${recentOpeners.map((o) => `"${o}"`).join('\n    ')}`
    : '';

  return `APPROACH (this turn only — vary the route, never the truth):
  Entry: ${entry}.
  Shape: ${shape}.
  Texture: ${texture}.
  Avoid these stock formulations entirely — they are the fingerprints of generic machine writing: ${BANNED_TELLS.map((t) => `"${t}"`).join(', ')}. Hard ban this turn: do NOT define anything by what it is not. No "you aren't X, you're Y", no "it's not X, it's Y", no "not because X, but because Y". That inversion is the single most recognizable machine reflex there is, and it is off the table — state the thing directly instead. Never open with it.
  Do not restate their question before answering it. Do not summarize what you just said at the end.${openerBan}

  ORDER OF PRIORITY — absolute: accuracy first, usefulness second, originality third. If a fresh angle would bend a number, soften a real finding, obscure the answer, or cost the person warmth they need right now, drop the angle and be plain. Unusual phrasing that is wrong is worthless; the freshness must be in HOW you see it, never in decorating what is true. If the most original thing available is a blunt, simple sentence, that is the original thing — say it.`;
}