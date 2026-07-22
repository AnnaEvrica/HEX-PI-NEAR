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
  if (task === 'research') return LLM_POOL.claude;
  if (task === 'casual') return LLM_POOL.gpt;
  return LLM_POOL.gemini;
}