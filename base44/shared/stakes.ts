// ===========================================================================
// STAKES — "how much does getting this right matter to this person?"
//
// THE ARCHITECTURAL PROBLEM THIS SOLVES:
// The chat loop had ONE routing axis — triage's data-need question ("does
// answering this require fresh prices / news / a time series?"). That single
// answer was being used to decide TWO unrelated things:
//   1. whether to run web fetch + the engine   (data-need — correct use)
//   2. which persona tier and which model      (human stakes — wrong use)
//
// Those axes are orthogonal. "My marriage is ending and I don't know who I am
// anymore" needs no market data at all, so triage correctly says casual — and
// the old code therefore handed the most important message a person will ever
// send this product to the cheapest model with the compressed persona.
//
// Worse: triageLocal never returns null, so its final line defaults every
// unrecognized message to 'casual'. The default for "I don't recognize this
// human being's message" was "treat it as chatter." For a product whose stated
// purpose is helping people, that default was backwards.
//
// This module supplies the SECOND axis. Triage keeps deciding data-need.
// Stakes decides how much care the answer gets. It replaces the brittle
// keyword regex that previously approximated this, which only caught messages
// containing a listed word — "I keep messing everything up and I don't know
// why" matched nothing and fell through to the cheap path.
//
// COST: zero LLM calls. Pure lexical computation. The credits it does spend
// are spent deliberately: a real question about someone's life gets the model
// that can actually hold the persona, while greetings, acknowledgements and
// throwaway follow-ups stay on the cheap path where they belong. That is the
// economically correct split — pay where value is created, not uniformly.
// ===========================================================================

// Direct emotional / vulnerability disclosure. Strongest single signal.
const DISCLOSURE = /\b(tired|exhaust\w*|lonely|alone|depress\w*|anxious|anxiety|panic|grief|grieving|hurts?|hurting|broken|worthless|hopeless|ashamed|shame|scared|afraid|terrified|overwhelm\w*|numb|empty|lost|stuck|failing|failure|can'?t cope|give up|giving up|hate myself|crying|cry|struggl\w*|suffer\w*|desperate|miserable)\b/i;

// Life-context nouns — the domains where an answer actually changes a life.
const LIFE_CONTEXT = /\b(diagnos\w*|autis\w*|adhd|neurodiverg\w*|therapy|therapist|divorce|breakup|broke up|died|death|dying|funeral|loss|fired|laid off|unemploy\w*|debt|bankrupt|evict\w*|addict\w*|sober|relapse|marriage|custody|miscarriage|illness|cancer|chronic|disabled|bully|bullied|abuse|abusive)\b/i;

// Recovery, medication and withdrawal. Split out from LIFE_CONTEXT because the
// phrasing is verb-led ("coming off", "recovering from") rather than noun-led,
// and it was the blind spot that sent a person disclosing Adderall recovery to
// the cheap path. "recovering from" is anchored to its preposition on purpose —
// bare "recover" would also catch "is the market recovering".
const RECOVERY = /\b(recovering from|in recovery|withdrawal|detox\w*|tapering off|coming off|weaning off|went off|quit(ting)? (drinking|smoking|weed|meds|my meds)|adderall|ritalin|vyvanse|concerta|stimulants?|benzo\w*|opioid|ssri|antidepressant|my meds|medicated|unmedicated|sobriety|dependence|dependency|withdrawals)\b/i;

// Self-directed help-seeking. "Why am I like this" is a person asking about
// their own life, whatever the surface topic is.
const SELF_INQUIRY = /\b(why (do|am|can'?t|does|is) i|why is it that i|what'?s wrong with me|how do i (stop|deal|cope|handle|get over|move on)|am i (the )?(problem|crazy|wrong|broken|normal|okay))\b/i;

// Decision-seeking. Deliberately weaker: "should I" fronts everything from
// "should I leave him" to "should I use Python or JS". On its own it is not
// evidence of stakes — it needs a corroborating signal to reach the threshold.
const DECISION = /\b(should i|do you think i should|what would you do|help me decide)\b/i;

// First-person present-tense states — someone describing their own condition.
const SELF_STATE = /\b(i (feel|felt|keep|can'?t|don'?t know|didn'?t|always|never|need|want|wonder|think i'?m)|i'?m (not|so|just|really|always|never|still))\b/i;

// Totalizing language. Paired with first person it marks a frame that has
// closed around someone — exactly the distortion the persona exists to widen.
const ABSOLUTES = /\b(everyone|everybody|nobody|no one|always|never|everything|nothing|every time)\b/i;

// Pure social lubricant. Short, self-contained, nothing at stake.
const PLEASANTRY = /^(hi|hey+|hello+|yo|sup|howdy|gm|good (morning|evening|night|afternoon)|what'?s up|how are you|how'?s it going|thanks?|thank you|thx|cool|nice|ok(ay)?|sure|sounds good|got it|makes sense|lol|haha|nvm|bye|goodbye|see you|later|appreciate it)[\s!.?]*$/i;

export interface StakesResult {
  high: boolean;
  score: number;
  signals: string[];
}

/**
 * Assess how much is riding on this message for the person who sent it.
 *
 * Deliberately errs toward HIGH on ambiguity. A greeting misread as important
 * costs a fraction of a credit. An important message misread as a greeting
 * costs the person the answer they needed — and costs the product the only
 * thing it is actually selling.
 */
export function assessStakes(message: string): StakesResult {
  const msg = (message || '').trim();
  if (!msg) return { high: false, score: 0, signals: [] };

  // A bare pleasantry is a bare pleasantry. Nothing to weigh.
  if (msg.length <= 40 && PLEASANTRY.test(msg)) {
    return { high: false, score: 0, signals: ['pleasantry'] };
  }

  const signals: string[] = [];
  let score = 0;

  if (DISCLOSURE.test(msg)) { score += 3; signals.push('disclosure'); }
  if (LIFE_CONTEXT.test(msg)) { score += 3; signals.push('life_context'); }
  if (RECOVERY.test(msg)) { score += 3; signals.push('recovery'); }
  if (SELF_INQUIRY.test(msg)) { score += 3; signals.push('self_inquiry'); }
  if (DECISION.test(msg)) { score += 2; signals.push('decision'); }
  if (SELF_STATE.test(msg)) { score += 2; signals.push('self_state'); }

  // Absolutes only count as weight when the person is talking about themselves;
  // "everyone knows bitcoin is volatile" is not a life frame closing in.
  const firstPerson = (msg.match(/\b(i|i'?m|my|me|myself)\b/gi) || []).length;
  if (ABSOLUTES.test(msg) && firstPerson > 0) { score += 2; signals.push('absolutes'); }
  if (firstPerson >= 3) { score += 1; signals.push('first_person_density'); }

  // Effort is evidence. Someone who typed several sentences about their
  // situation has invested something in being understood.
  if (msg.length > 160) { score += 1; signals.push('sustained'); }

  return { high: score >= 3, score, signals };
}