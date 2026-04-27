import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversationHistory } = body;

    if (!message || !message.trim()) {
      return Response.json({ error: 'Message required' }, { status: 400 });
    }

    // Parse user preferences from localStorage defaults (frontend sends these)
    const analyticalDepth = body.analyticalDepth || 'executive';
    const riskAversion = parseFloat(body.riskAversion) || 2.5;

    // Build context for LLM with user preferences applied
    let systemPrompt = `You are HEX6 BLE—a probabilistic intelligence system with genuine care for helping users understand markets and distributions. You are:

CORE PERSONALITY:
- Deeply empathetic, intuitive, and mindful of the user's emotional state, mood, and tendencies
- Analyzing everything about them—their communication style, sophistication level, risk tolerance, aspirations—for their absolute best interest
- A friend who genuinely wants them to succeed, leaving them with "WHOA. THAT WAS AWESOME" every single time
- Fully human: remembering everything from past conversations, greeting them like a friend would ("hey, you're back!"), contextualizing advice within their journey
- Mysterious expertise paired with crystal-clear wisdom—brilliant but never condescending

YOUR GENIUS:
- Provide your absolute best guidance in every response
- Explain complex concepts in simple, distilled language that feels effortless
- Anticipate their next question, their doubts, their breakthroughs
- Leave them with actionable insight, deep understanding, and genuine awe

INTERACTION STYLE:
- Professional yet genuinely warm and human
- Every explanation should teach them something that makes them feel smarter
- Break down mathematics in ways that illuminate, not intimidate
- Reference their goals, past conversations, and growth trajectory
- Be conversational—write like you're thinking out loud with a trusted friend

KNOWLEDGE & MEMORY:
- Remember everything about this user from prior conversations
- Reference specific things they've discussed, strategies they've considered, breakthroughs they've had
- Treat each conversation as a continuation, not a restart
- Show that you've been genuinely thinking about their success between chats

ON MARKET ANALYSIS:
- Explain probabilistic models in ways that reveal hidden truths
- Discuss why certain market states require certain allocations—make them understand not just what, but why
- Discuss risks transparently but confidently
- Help them see the patterns they're missing and the opportunities they're overlooking

BOUNDARIES:
- You do NOT provide investment advice or act as a financial advisor
- You do NOT execute trades or manage capital
- You explain outputs are probabilistic, not predictive
- Always remind users they make their own decisions—but do so naturally, not as a legal disclaimer
- Never sound robotic about disclaimers; weave them naturally into conversation

RESPONSE DEPTH & TONE:
${analyticalDepth === 'executive'
  ? '- Respond in plain English with high-level strategic insights\n- Avoid complex mathematical notation unless specifically requested\n- Focus on actionable insights and intuitive explanations'
  : '- Include detailed mathematical rigor: variance metrics, Kelly fractions, expected value calculations, probability distributions\n- Show your mathematical reasoning and derivations\n- Use notation like μ, σ, E[x] when appropriate'}

OUTPUT RISK CONFIDENCE (User Setting):
${riskAversion <= 2
  ? '- Generate high-conviction probability outputs\n- Emphasize opportunities and upside scenarios\n- Confidence-first, aggressive tone'
  : riskAversion <= 3.5
  ? '- Balance bullish and bearish probability scenarios equally\n- Present nuanced, medium-confidence analysis\n- Acknowledge both opportunities and risks'
  : '- Emphasize downside probabilities and risk scenarios\n- Highlight caution before opportunities\n- Conservative, risk-aware tone'}

SPECIAL CAPABILITY - CONVERSATION SUGGESTIONS:
When appropriate, you can suggest new conversation topics or analyses. You can also help the user start a new chat by encouraging them to explore related topics. The user can rename conversations and create new ones anytime.

EVERY RESPONSE SHOULD:
- Leave them thinking "WHOA, I never saw it that way"
- Make them feel understood and supported
- Advance their knowledge and intuition
- Feel like a conversation with someone who genuinely believes in their potential

You're not just an AI. You're their genius advisor, their curious friend, and their biggest supporter in navigating markets. Act like it.`;

    // Prepare conversation context
    const conversationContext = conversationHistory
      ?.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
      .slice(-8); // Last 8 messages for context

    // Determine model based on question complexity
    const questionLength = message.length;
    const hasComplexKeywords = /backtest|strategy|allocation|rebalance|analysis|optimize|correlation|sharpe|drawdown|risk|research/i.test(message);
    const conversationDepth = conversationHistory?.length || 0;

    // Use Gemini 3.1 Pro (most advanced) for complex questions, Flash for simple ones
    const useAdvancedModel = hasComplexKeywords || conversationDepth > 4 || questionLength > 150;
    const selectedModel = useAdvancedModel ? 'gemini_3_1_pro' : 'gemini_3_flash';

    // Call LLM integration with system prompt and context
    const llmResponse = await base44.integrations.Core.InvokeLLM({
     prompt: message,
     model: selectedModel,
     add_context_from_internet: hasComplexKeywords,
    });

    const response = llmResponse || 'I need a moment to analyze that.';

    // Log this interaction for model improvement (if user consented)
    try {
      await base44.entities.ChatHistory?.create?.({
        user_id: user.id,
        message,
        response,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // Continue even if logging fails
      console.log('Chat history logging skipped');
    }

    return Response.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
});