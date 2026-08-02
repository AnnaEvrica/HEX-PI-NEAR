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
  // The persona is a long, nuanced behavioral instruction (~3500 words).
  // Only Claude Sonnet reliably EMBODIES it — lighter models (gpt_5_mini,
  // gemini_flash) skim it and fall back to their default chatty register
  // ("hey anna", no NAME LOCK, no embodiment). Gemini Flash stays the
  // interpretation/web-fetch model (data extraction, not persona-bearing),
  // so only the persona-bearing reply pays for Claude — the cheap MoE model
  // still handles retrieval upstream.
  return LLM_POOL.claude;
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