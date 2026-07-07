import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, preferences = {} } = await req.json();

    if (action !== 'sendTest') {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Recipient is always the authenticated user — never trust a client-supplied email.
    const recipient = user.email;
    if (!recipient) {
      return Response.json({ error: 'No verified email on account' }, { status: 400 });
    }

    // Validate preferences schema — only allow known, primitive fields to prevent LLM prompt injection.
    const safePrefs = {};
    if (Array.isArray(preferences.assets)) {
      safePrefs.assets = preferences.assets
        .filter((a) => typeof a === 'string' && /^[A-Z0-9.-]{1,10}$/.test(a))
        .slice(0, 10);
    }
    if (typeof preferences.marketTrends === 'boolean') safePrefs.marketTrends = preferences.marketTrends;
    if (typeof preferences.predictions === 'boolean') safePrefs.predictions = preferences.predictions;

    // Generate personalized HEX6 insight using LLM
    const insight = await generateInsight(base44, user, safePrefs);

    // Send email with HEX6 voice and formatting
    await base44.integrations.Core.SendEmail({
      to: recipient,
      subject: `HEX6 Oracle: ${insight.subject}`,
      body: formatEmailBody(insight, user),
      from_name: 'HEX6 Oracle',
    });

    return Response.json({
      message: 'Insight sent',
      preview: insight.preview,
    });
  } catch (error) {
    console.error('Notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function generateInsight(base44, user, preferences) {
  try {
    // Get user's conversation history (simulated from localStorage in chat)
    // In production, you'd fetch actual conversation records
    const prompt = buildPrompt(user, preferences);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          marketAnalysis: { type: 'string' },
          keyInsight: { type: 'string' },
          actionableThought: { type: 'string' },
          preview: { type: 'string' },
        },
      },
    });

    return {
      subject: result.subject || 'Market Probability Update',
      marketAnalysis: result.marketAnalysis,
      keyInsight: result.keyInsight,
      actionableThought: result.actionableThought,
      preview: result.preview,
    };
  } catch (err) {
    console.error('LLM error:', err);
    // Fallback insight
    return {
      subject: 'System State Classification',
      marketAnalysis: 'Markets are maintaining their current probability distribution. No significant regime shift detected.',
      keyInsight: 'Uncertainty is your ally when properly quantified.',
      actionableThought: 'Consider: what outcomes are you underpricing in your mental model?',
      preview: 'HEX6 has detected stable market conditions with opportunities emerging in allocations.',
    };
  }
}

function buildPrompt(user, preferences) {
  const { marketTrends, predictions, assets } = preferences;
  const assetList = assets && assets.length > 0 ? assets.join(', ') : 'general markets';

  return `You are HEX6 Oracle, a probabilistic allocation intelligence system. Generate a compelling, personalized market insight email for ${user.full_name || 'a user'}.

The email should:
1. Be written in HEX6's voice: thoughtful, data-driven, probabilistic (never certain)
2. Reference their interest in: ${marketTrends ? 'market trends and analysis' : ''}${predictions ? ', allocations and opportunities' : ''}
3. Focus on: ${assetList}
4. Leave them with "whoa" - a surprising insight or reframed perspective
5. Prompt deeper thinking with a question
6. Be a natural continuation of an ongoing conversation
7. Include specific, actionable probability-based thinking

Keep the tone between academic rigor and conversational insight. Avoid jargon unless necessary. Every sentence should either provide data, reframe thinking, or prompt investigation.

Generate a JSON response with:
- subject: compelling subject line (max 50 chars)
- marketAnalysis: 2-3 paragraph market analysis tied to their interests
- keyInsight: the "whoa" moment or surprising reframe (1 paragraph)
- actionableThought: a thinking prompt or reflection question (1-2 sentences)
- preview: brief preview text for email client`;
}

function formatEmailBody(insight, user) {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #e5e5e5; background: #0a0a0a; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #ff8f5e 100%); padding: 30px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 24px; font-weight: 700; }
    .header p { margin: 5px 0 0; color: rgba(255,255,255,0.8); font-size: 13px; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: 700; color: #ff6b35; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .section-body { font-size: 15px; color: #d1d1d1; line-height: 1.7; }
    .insight-box { background: #0f0f0f; border-left: 3px solid #ff6b35; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .insight-box p { margin: 0; font-style: italic; color: #e5e5e5; }
    .thought-prompt { background: #1a2a2a; padding: 15px; border-radius: 4px; margin: 15px 0; border: 1px solid #2a4a4a; }
    .thought-prompt p { margin: 0; font-size: 14px; color: #a8d8ff; }
    .footer { background: #0f0f0f; padding: 20px 30px; font-size: 12px; color: #666; border-top: 1px solid #333; }
    .footer p { margin: 5px 0; }
    .cta-button { display: inline-block; background: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 15px; }
    .divider { height: 1px; background: #333; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HEX6 Oracle</h1>
      <p>Probabilistic Market Intelligence · ${timestamp}</p>
    </div>

    <div class="content">
      <p style="margin: 0 0 20px 0; color: #a0a0a0;">Probability Update</p>

      <div class="section">
        <div class="section-title">Market Analysis</div>
        <div class="section-body">
          ${insight.marketAnalysis}
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="insight-box">
          <p>💡 ${insight.keyInsight}</p>
        </div>
      </div>

      <div class="section">
        <div class="thought-prompt">
          <p><strong>For your consideration:</strong> ${insight.actionableThought}</p>
        </div>
      </div>

      <div class="divider"></div>

      <p style="font-size: 13px; color: #808080; margin-top: 20px;">
        HEX6 learns from every interaction. Your responses to these insights improve future analysis. 
        <a href="#" style="color: #ff6b35; text-decoration: none;">Continue conversation</a>
      </p>
    </div>

    <div class="footer">
      <p>HEX6 Oracle generates probabilistic analysis, not investment advice.</p>
      <p>Manage notifications in your <a href="#" style="color: #ff6b35; text-decoration: none;">account settings</a></p>
    </div>
  </div>
</body>
</html>`;
}