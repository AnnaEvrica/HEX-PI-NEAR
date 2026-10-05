// ===========================================================================
// Model router — the one place model IDs are named.
//
// Claude writes the small in-browser calls (dictation clean-up, conversation
// titles in the frontend). To move to a newer Claude, change CLAUDE_MODEL.
//
// The backend synthesis (think/entry.ts) uses gemini_3_1_pro with
// add_context_from_internet so Hex can browse the web while writing its reply.
// WEB_MODEL (gemini_3_flash) handles the retrieval step. Set CLAUDE_MODEL
// once Base44 supports web context on Claude and switch the synthesis back.
// ===========================================================================

export const CLAUDE_MODEL = 'claude_sonnet_4_6';
export const WEB_MODEL = 'gemini_3_flash';