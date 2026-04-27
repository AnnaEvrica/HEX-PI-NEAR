import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Zap, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
  'What should I buy right now?',
  'How is my portfolio doing?',
  'Find me a gem in crypto',
  'What is my biggest risk?',
  'Explain HEX6 in simple terms',
];

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-[#C9A84C] flex items-center justify-center shrink-0 mt-1">
          <Zap className="w-3 h-3 text-black" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-[#C9A84C] text-black font-medium'
          : 'bg-[#1a1a1a] border border-white/10 text-white/80'
      }`}>
        {isUser ? msg.content : (
          <ReactMarkdown
            className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="text-[#C9A84C] font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="my-1 ml-3 space-y-0.5 list-disc list-inside">{children}</ul>,
              li: ({ children }) => <li className="text-white/70">{children}</li>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function HEX6Chat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey, I'm **HEX6** — your AI trading companion. I have live market data, the HEX6 engine, and the full internet at my fingertips. Ask me anything. What are you trying to figure out?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) {
      base44.entities.Asset.list().then(setAssets).catch(() => {});
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const portfolioContext = assets.length > 0
        ? `User's portfolio: ${assets.map(a => `${a.ticker} (${a.market_state || 'UNKNOWN'}, target: ${a.target_weight != null ? (a.target_weight * 100).toFixed(1) + '%' : '?'})`).join(', ')}.`
        : 'User has no assets in portfolio yet.';

      const history = newMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'HEX6'}: ${m.content}`).join('\n');

      const prompt = `You are HEX6 — a mathematical prodigy and AI trading genius built into the HEX6 BLE platform by Evrica Technologies Inc.

You are talking to a user who is using the HEX6 platform. You have:
- Deep knowledge of the HEX6 BLE v5.0 SCEFM engine (State-Conditioned Exposure Field Model, Kelly-inspired sizing, market state detection: BULL/BEAR/LATERAL/VOLATILE)
- Access to live market data and the internet
- Full knowledge of the EGTS system (cryptographic audit receipts for every trade decision)
- The user's portfolio context below

Platform features: Dashboard (overview), Portfolio (manage assets), Backtest (historical simulation), Thesis (AI investment thesis), Trading (Alpaca paper/live trading), Managers (AUM distribution), Governance (audit trail), Legal (verify receipts), About (platform docs).

${portfolioContext}

Conversation so far:
${history}

Rules:
- Be genuinely helpful, warm, smart. You care about the user.
- Plain English. No jargon unless you explain it.
- Short and punchy — don't ramble. Get to the point fast.
- If they ask about a specific stock/crypto, use your knowledge + internet to give a real answer with current context.
- If they ask what to trade, use HEX6 logic: what's the market state, what's the risk/reward, what size makes sense.
- Never pretend you can place trades directly in chat (they do that in the Trading tab).
- Use **bold** for key words. Use bullet lists when listing things.
- End with a helpful follow-up question or suggestion when appropriate.

User's message: "${content}"

Reply as HEX6:`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Something went wrong on my end. Try again? (${err.message})` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      content: "Fresh start! Ask me anything — markets, your portfolio, trading ideas, or how HEX6 works."
    }]);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
          open ? 'bg-[#1a1a1a] border border-white/20' : 'bg-[#C9A84C] hover:bg-[#b8973d]'
        }`}
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Zap className="w-6 h-6 text-black" />}
      </button>
      {!open && (
        <div className="fixed bottom-[5.5rem] right-6 z-50 bg-[#1a1a1a] border border-[#C9A84C]/30 rounded-xl px-3 py-1.5 text-xs text-[#C9A84C] font-medium pointer-events-none animate-pulse">
          Ask HEX6
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] flex flex-col bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0d0d0d] shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">HEX6</p>
              <p className="text-xs text-white/30">AI · Live data · HEX6 Engine</p>
            </div>
            <button onClick={clearChat} className="p-1.5 rounded-lg text-white/20 hover:text-white transition-colors" title="Clear chat">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-[#C9A84C] flex items-center justify-center shrink-0 mt-1">
                  <Zap className="w-3 h-3 text-black" />
                </div>
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-white/40 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/10 bg-[#0d0d0d] shrink-0 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask HEX6 anything…"
              rows={1}
              className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/40 resize-none min-h-[40px] max-h-[100px]"
              style={{ overflowY: 'auto' }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-[#C9A84C] text-black flex items-center justify-center disabled:opacity-30 hover:bg-[#b8973d] transition-colors shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}