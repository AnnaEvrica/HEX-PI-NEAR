// ===========================================================================
// Model router — the one place model IDs are named.
//
// Claude is the exclusive language layer: it interprets, triages and writes
// every reply. To move to a newer Claude, change CLAUDE_MODEL (Base44 also
// lists 'claude_opus_4_8' and 'claude-sonnet-5').
//
// One exception: Base44's `add_context_from_internet` (live web retrieval) is
// only supported on Gemini models. WEB_MODEL fetches; Claude writes. Set
// WEB_MODEL to CLAUDE_MODEL once Base44 supports web context on Claude.
// ===========================================================================

export const CLAUDE_MODEL = 'claude_sonnet_4_6';
export const WEB_MODEL = 'gemini_3_flash';

