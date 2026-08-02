// ===========================================================================
// LLM Model Pool — the "2A Switch" of The Model's Control Panel (backend-only).
//
// Structure 1, Pillar 2 — the LLM Module. The Control Panel analyzes the
// incoming signal and selects the realizing LLM from the Transformer Network
// Model Pool. This decision is an internal bridge between signal interpretation
// and generation; it is never exposed to the user.
//
// Routing basis — Semantic Compression Ratio (SCR): Lexical Density / Context
// Capacity. Dense long-context work needs trans-contextual coherence; light
// interpretation benefits from sparse, compute-efficient activation.
//
// Pool:
//   Gemini Flash — Sparse Mixture of Experts (MoE). Default interpretation of
//                  input + web retrieval + default engine synthesis. Activates
//                  a fraction of weights per token → high semantic processing
//                  without massive compute.
//   GPT (mini)   — Simplest general generator. Casual / low-stakes replies.
//   Claude        — Dense & Hybrid Attention (Trans-Contextual Embedding, TCE).
//                  Long legal & analytical workflows / article generation for
//                  the Evrica Foundation. Maximizes semantic coherence over
//                  long form. (No web search — Gemini fetches, Claude writes.)
// ===========================================================================

export const LLM_POOL = {
  gemini: 'gemini_3_flash',     // MoE — interpretation, web fetch, default synthesis
  gpt: 'gpt_5_mini',           // simplest — casual replies
  claude: 'claude_sonnet_4_6',  // TCE — long-form research / articles
};

// The interpretation step always uses Gemini Flash (MoE) — the default
// "interpretation of Input". Web retrieval also requires a Gemini model
// (only gemini_* support add_context_from_internet).
export const INTERPRETATION_MODEL = LLM_POOL.gemini;

// The 2A Switch — chooses the realizing LLM from the pool based on the
// Control Panel's task classification.
//   'research'   → Claude  (long-form coherence, TCE)
//   'casual'     → GPT     (simplest general generator)
//   'analytical' / 'inline' / default → Gemini Flash (default engine synthesis)
export function selectSynthesisModel(task) {
  // MULTI-MODEL ARCHITECTURE — the persona lives for every model with
  // sufficient capacity to hold it. The persona embodiment itself is enforced
  // model-agnostically (top-of-file DOMAIN LOCK + NAME LOCK in persona.ts, and
  // a recency FINAL LOCK at the generation boundary in composePrompt), so
  // whatever model realizes the reply embodies the identity.
  //   research → Claude (long-form TCE coherence)
  //   casual / analytical / inline → Gemini Flash (MoE, full context capacity)
  // gpt_5_mini is excluded from synthesis: its context capacity can't hold the
  // full persona, so routing casual to it guaranteed the persona wouldn't live
  // there — a capacity ceiling, not a prompt failure.
  if (task === 'research') return LLM_POOL.claude;
  return LLM_POOL.gemini;
}

// Model-aware tone/resonance — the PI-US voice register adapts to the
// methodology of the realizing LLM the Model selected. The Model leads; the LLM
// is a tool, and the tone steers each tool toward the structural read rather
// than letting the tool's native tendencies drift the answer.
export function adaptVoiceForModel(baseVoice, model) {
  if (model === LLM_POOL.claude)
    return `${baseVoice}; lean into Claude's trans-contextual coherence — sustain the register across long form, let the structure carry, don't restate`;
  if (model === LLM_POOL.gpt)
    return `${baseVoice}; keep it textured and specific — favor one concrete image over generic phrasing`;
  // Gemini Flash (MoE) — default realization tool
  return `${baseVoice}; stay focused and precise — converge on the answer, don't let the mixture sprawl`;
}