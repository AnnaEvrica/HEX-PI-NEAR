import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Sparkles, TrendingUp, AlertTriangle, BookOpen, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const PERSONAS = [
  { id: 'trader', label: 'Trader', desc: 'Fast, actionable signals' },
  { id: 'academic', label: 'Academic', desc: 'Rigorous quantitative analysis' },
  { id: 'simple', label: 'Plain English', desc: 'No jargon, easy to understand' },
];

const QUICK_ACTIONS = [
  { label: 'What is this asset?', icon: BookOpen },
  { label: 'Should I buy or sell right now?', icon: TrendingUp },
  { label: 'Explain the market state', icon: Sparkles },
  { label: 'What does HEX6 recommend?', icon: Zap },
];

function getBubbleStyle(role) {
  if (role === 'user') return 'bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-white self-end';
  return 'bg-[#111111] border border-white/10 text-white/80 self-start';
}

export default function AssetAI({ asset, onRebalance, onSilence, triggering }) {
  const [persona, setPersona] = useState('trader');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    const personaInstructions = {
      trader: `You are a sharp institutional trader's assistant. Be concise, use trading terminology (alpha, beta, drawdown, momentum, Sharpe, etc.). Give direct buy/sell/hold signals. Reference the HEX6 engine state. Use bullet points. Keep it tight.`,
      academic: `You are a quantitative finance researcher. Be rigorous and precise. Reference statistical concepts, portfolio theory (MPT, Black-Litterman, Kelly Criterion), and the HEX6 BLE SCEFM engine mechanics. Use LaTeX-style notation where helpful. Cite concepts from Markowitz, Fama-French, etc.`,
      simple: `You are a friendly financial guide explaining things to someone with no finance background. Avoid all jargon. Use simple analogies (e.g., "think of it like..."). Be warm and encouraging. Make the user feel confident. If they ask about technical things, translate them into everyday language.`,
    };

    // Detect if user is asking to trigger an action
    const lower = userText.toLowerCase();
    const wantsRebalance = lower.includes('rebalance') && (lower.includes('run') || lower.includes('trigger') || lower.includes('do') || lower.includes('execute'));
    const wantsSilence = lower.includes('silence') && (lower.includes('activate') || lower.includes('trigger') || lower.includes('enable') || lower.includes('do'));

    let assistantReply = '';

    if (wantsRebalance) {
      const confirmMessages = [...newMessages, { role: 'assistant', content: `Triggering HEX6 rebalance for **${asset.ticker}**… 🔄` }];
      setMessages(confirmMessages);
      await onRebalance();
      assistantReply = `✅ Rebalance executed for **${asset.ticker}**. An EGTS receipt has been minted and is now visible in the Contracts tab. The HEX6 engine has re-computed optimal exposure based on current market state: **${asset.market_state || 'UNKNOWN'}**.`;
    } else if (wantsSilence) {
      const confirmMessages = [...newMessages, { role: 'assistant', content: `Activating Silence Mode for **${asset.ticker}**… ⚠️` }];
      setMessages(confirmMessages);
      await onSilence();
      assistantReply = `✅ Silence Mode activated for **${asset.ticker}**. Exposure set to zero. An immutable EGTS receipt has been minted. This is a protective measure — the asset is now paused from active allocation until manually reactivated.`;
    } else {
      const prompt = `
${personaInstructions[persona]}

You are analyzing the following asset for a user:
- Ticker: ${asset.ticker}
- Full Name: ${asset.name}
- Asset Class: ${asset.asset_class}
- Market State: ${asset.market_state || 'UNKNOWN'}
- Current Weight: ${asset.current_weight != null ? (asset.current_weight * 100).toFixed(2) + '%' : 'Not set'}
- Target Weight: ${asset.target_weight != null ? (asset.target_weight * 100).toFixed(2) + '%' : 'Not set'}
- Status: ${asset.is_active ? 'Active' : 'Inactive'}
- Description: ${asset.description || 'None provided'}

The platform uses HEX6 BLE v5.0 (Binary Likelihood Engine), a State-Conditioned Exposure Field Model (SCEFM) that calculates portfolio allocations based on historical return distributions and market states (BULL, BEAR, LATERAL, VOLATILE, SILENCE).

Governance receipts are minted as cryptographic EGTS (Evrica Global Token Standard) immutable audit records.

Available actions the user can ask you to perform:
- "trigger rebalance" → runs the HEX6 engine and mints an EGTS receipt
- "activate silence mode" → sets exposure to zero and mints a EGTS receipt

Conversation history:
${newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Respond to the user's latest message. Use markdown for formatting. Be helpful and match the persona strictly.
`.trim();

      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      assistantReply = typeof res === 'string' ? res : res?.text || 'I could not generate a response.';
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: assistantReply }]);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[600px] bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
      {/* Persona selector */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10 shrink-0 bg-[#111111]">
        <Sparkles className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" />
        <span className="text-xs text-white/30 mr-1">Explain as:</span>
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPersona(p.id)}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-colors',
              persona === p.id
                ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10'
                : 'border-white/10 text-white/30 hover:text-white/60'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="space-y-1">
              <p className="text-white/60 text-sm font-medium">Ask me anything about {asset.ticker}</p>
              <p className="text-white/25 text-xs">I can explain, analyze, and even trigger engine actions</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map(({ label, icon: QuickIcon }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(label)}
                  className="flex items-start gap-2 p-3 rounded-xl bg-[#111111] border border-white/10 text-left hover:border-[#C9A84C]/30 transition-colors group"
                >
                  <QuickIcon className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] px-4 py-3 rounded-xl text-sm', getBubbleStyle(msg.role))}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:text-white/80 prose-strong:text-white prose-code:text-[#C9A84C]"
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-xl bg-[#111111] border border-white/10 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-white/30">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10 shrink-0 bg-[#111111]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`Ask about ${asset.ticker}… or say "trigger rebalance"`}
            className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-lg bg-[#C9A84C] text-black hover:bg-[#b8973d] transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}