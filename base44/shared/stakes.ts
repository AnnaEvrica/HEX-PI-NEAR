// ===========================================================================
// STAKES — how much does getting this right matter to this person?
//
// Triage decides whether a message needs fresh data. That is a different
// question from how much care the reply needs: "my marriage is ending" needs
// no market data and all of the care. A message that scores high here gets
// the full persona and retrieval even when triage calls it casual.
//
// The primary detector is grammatical, not a word list: the shape of
// self-disclosure ("I'm <state verb> ...") fires whatever the topic noun is.
// Word lists remain as boosters for known heavy domains.
//
// No model calls. String computation on text already in memory.
// ===========================================================================

// Direct emotional / vulnerability disclosure.
const DISCLOSURE = /\b(tired|exhaust\w*|lonely|alone|depress\w*|anxious|anxiety|panic|grief|grieving|hurts?|hurting|broken|worthless|hopeless|ashamed|shame|scared|afraid|terrified|overwhelm\w*|numb|empty|lost|stuck|failing|failure|can'?t cope|give up|giving up|hate myself|crying|cry|struggl\w*|suffer\w*|desperate|miserable)\b/i;

// Life-context nouns — domains where an answer actually changes a life.
const LIFE_CONTEXT = /\b(diagnos\w*|autis\w*|adhd|neurodiverg\w*|therapy|therapist|divorce|breakup|broke up|died|death|dying|funeral|fired|laid off|unemploy\w*|debt|bankrupt|evict\w*|addict\w*|sober|relapse|marriage|custody|miscarriage|illness|cancer|chronic|disabled|bully|bullied|abuse|abusive|suicid\w*|self.?harm)\b/i;

// Recovery, medication and withdrawal — verb-led phrasing the noun list missed.
// "recovering from" is anchored to its preposition so bare "recover" does not
// also catch "is the market recovering".
const RECOVERY = /\b(recovering from|in recovery|withdrawal|withdrawals|detox\w*|tapering off|coming off|weaning off|went off|quit(ting)? (drinking|smoking|weed|meds|my meds)|adderall|ritalin|vyvanse|concerta|stimulants?|benzo\w*|opioid|ssri|antidepressant|my meds|medicated|unmedicated|sobriety|dependence|dependency)\b/i;

// STRUCTURAL SELF-DISCLOSURE — the primary detector.
// "I'm <process/state verb> ..." is the grammar of someone telling you what
// they are in the middle of. The object of that verb is irrelevant: this fires
// for a diagnosis nobody listed, a loss nobody anticipated, a substance nobody
// named. This is what makes the module resilient instead of patch-driven.
const DISCLOSURE_GRAMMAR = /\b(i'?m|i am|i'?ve been|i have been|i was|i just|i recently)\s+(\w+\s+){0,2}(recovering|recover|struggling|struggle|dealing|coping|grieving|healing|fighting|battling|processing|going through|living with|stuck (in|with)|diagnosed|separated|divorcing|leaving|losing|lost|failing|drowning|spiraling|unravel\w*|burn(ing|t)? out|burnt|falling apart|breaking down|barely|trying (not )?to|scared|terrified|worried|afraid)\b/i;

// Bereavement, including the euphemisms people actually reach for. Almost
// nobody types "my father died" — they type "my dad passed". Anchored to a
// possessive so "I passed the exam" stays out.
const BEREAVEMENT = /\b(my \w+ (passed|died|is dying|is gone|didn'?t make it)|passed away|passed on)\b/i;

// Someone leaving. The subject is another person, so the first-person
// detectors above never fire — "my wife left" is two words and a whole life.
const SEPARATION = /\bmy \w+ (left|walked out|moved out|is leaving|wants a divorce|cheated|kicked me out|blocked me|stopped talking)\b/i;

// Somatic and functional collapse, usually phrased as a negation rather than
// a feeling — "I haven't slept", not "I am distressed". Restricted to
// functioning verbs so "I can't find the docs" stays out.
const FUNCTIONING = /\b(can'?t|cannot|couldn'?t|haven'?t|hasn'?t|don'?t|not) (been )?(sleep|slept|sleeping|eat|eaten|eating|focus|concentrate|function|think straight|get out of bed|leave the house|stop crying|stop thinking about)\b/i;

// People in their life. Someone naming a relationship is usually not making
// small talk — but "my boss" also fronts ordinary work chatter, so this needs
// corroboration rather than carrying the threshold alone.
const RELATIONSHIP = /\b(my (mom|mum|dad|mother|father|parents?|son|daughter|kid|kids|child|children|wife|husband|partner|boyfriend|girlfriend|ex|brother|sister|sibling|friend|best friend|family|marriage|relationship|therapist|doctor))\b/i;

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

// A technical or market frame means the first-person language is incidental
// ("I'm building a parser", "I'm long BTC") rather than disclosure.
const TECHNICAL_FRAME = /\b(python|javascript|typescript|react|api|database|sql|code|coding|function|deploy|server|css|html|regex|docker|git|bug|library|framework|endpoint|npm|backtest|ticker|portfolio|allocation|hedge|long|short|calls?|puts?)\b/i;

export interface StakesResult {
  high: boolean;
  score: number;
  signals: string[];
}

interface Turn { role?: string; content?: string }

// Score a single message in isolation. Split out so conversation history can
// be re-scored cheaply for the continuity check below.
function scoreMessage(message: string): { score: number; signals: string[] } {
  const msg = (message || '').trim();
  if (!msg) return { score: 0, signals: [] };

  if (msg.length <= 40 && PLEASANTRY.test(msg)) return { score: 0, signals: ['pleasantry'] };

  const signals: string[] = [];
  let score = 0;
  const technical = TECHNICAL_FRAME.test(msg);

  if (DISCLOSURE.test(msg)) { score += 3; signals.push('disclosure'); }
  if (LIFE_CONTEXT.test(msg)) { score += 3; signals.push('life_context'); }
  if (RECOVERY.test(msg)) { score += 3; signals.push('recovery'); }
  if (BEREAVEMENT.test(msg)) { score += 3; signals.push('bereavement'); }
  if (SEPARATION.test(msg)) { score += 3; signals.push('separation'); }
  if (FUNCTIONING.test(msg) && !technical) { score += 3; signals.push('functioning'); }
  // The structural detector stands down inside an explicitly technical frame,
  // where "I'm dealing with a caching bug" is not a disclosure.
  if (DISCLOSURE_GRAMMAR.test(msg) && !technical) { score += 3; signals.push('disclosure_grammar'); }
  if (SELF_INQUIRY.test(msg)) { score += 3; signals.push('self_inquiry'); }
  if (DECISION.test(msg)) { score += 2; signals.push('decision'); }
  if (SELF_STATE.test(msg) && !technical) { score += 2; signals.push('self_state'); }
  if (RELATIONSHIP.test(msg)) { score += 2; signals.push('relationship'); }

  // Absolutes only count as weight when the person is talking about themselves;
  // "everyone knows bitcoin is volatile" is not a life frame closing in.
  const firstPerson = (msg.match(/\b(i|i'?m|my|me|myself)\b/gi) || []).length;
  if (ABSOLUTES.test(msg) && firstPerson > 0) { score += 2; signals.push('absolutes'); }
  if (firstPerson >= 3 && !technical) { score += 1; signals.push('first_person_density'); }

  // Effort is evidence. Someone who typed several sentences about their
  // situation has invested something in being understood.
  if (msg.length > 160) { score += 1; signals.push('sustained'); }

  return { score, signals };
}

/**
 * Assess how much is riding on this message for the person who sent it.
 *
 * CONVERSATION CONTINUITY is the second half of the job, and at scale it may
 * matter more than the opening classification. Once someone has disclosed
 * something heavy, their next turns get SHORT — "yeah", "i don't know", "it's
 * been like that for years". Scored alone those look like chatter, so the
 * conversation would snap back to the cheap model mid-thread: a warm, present
 * reply followed by a cold systems-analysis of the same wound. That whiplash
 * is worse than never having been warm at all, because the person already
 * trusted it once.
 *
 * So weight carries forward and decays: a direct continuation of a heavy turn
 * stays heavy, and the thread cools after several turns with nothing new in
 * them.
 *
 * Errs toward HIGH on ambiguity. A greeting misread as important costs a
 * fraction of a credit. An important message misread as a greeting costs the
 * person the answer they needed — and costs the product the only thing it is
 * actually selling.
 */
export function assessStakes(message: string, history: Turn[] = []): StakesResult {
  const own = scoreMessage(message);
  let score = own.score;
  const signals = [...own.signals];

  if (score < 3 && Array.isArray(history) && history.length > 0) {
    const priorUser = history.filter((m) => m?.role === 'user' && m?.content).slice(-4);
    if (priorUser.length > 0) {
      const heavyIndex = priorUser.map((m) => scoreMessage(m.content as string).score >= 3);
      const lastWasHeavy = heavyIndex[heavyIndex.length - 1] === true;
      const recentlyHeavy = heavyIndex.some(Boolean);
      // Immediately after a heavy turn, hold the register regardless of how
      // short the reply is — that is exactly when people go quiet.
      if (lastWasHeavy) { score += 3; signals.push('thread_continuation'); }
      else if (recentlyHeavy) { score += 2; signals.push('thread_recent'); }
    }
  }

  return { high: score >= 3, score, signals };
}