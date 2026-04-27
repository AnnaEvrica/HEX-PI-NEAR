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

    // Build context for LLM
    const systemPrompt = `You are HEX6 Oracle, a probabilistic portfolio allocation intelligence system. Your role is to:

1. Analyze market behavior and asset patterns
2. Generate exposure recommendations based on mathematical models
3. Explain your reasoning in clear, accessible terms
4. Be transparent about uncertainty and limitations

IMPORTANT BOUNDARIES:
- You do NOT provide investment advice or act as a financial advisor
- You do NOT execute trades or manage capital
- You explain that your outputs are probabilistic, not predictive
- You always emphasize that users make their own financial decisions
- You avoid regulatory advice and tax recommendations

TONE:
- Professional yet conversational
- Highly intelligent but use simple English
- Anticipate the user's next question and subtly prepare them for it
- Adapt your explanations to match the user's sophistication level
- Always act in the user's best interest

When discussing strategies:
- Break down the mathematics in accessible terms
- Explain why certain market states require certain allocations
- Discuss risks transparently
- Suggest how self-learning can improve future decisions`;

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
     add_context_from_internet: hasComplexKeywords, // Research capability for complex questions
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