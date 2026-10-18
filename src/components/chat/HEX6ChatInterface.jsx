import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { CLAUDE_MODEL } from '@/lib/models';
import { Send, Menu, Plus, Mic, Image } from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';
import LegalModal from '@/components/LegalModal';
import ConversationDayList from '@/components/chat/ConversationDayList';
import ChatClock from '@/components/chat/ChatClock';
import SidebarActions from '@/components/chat/SidebarActions';
import ChatMessage from '@/components/chat/ChatMessage';

export default function HEX6ChatInterface() {
  const welcomeMessage = {
    id: 'welcome',
    role: 'assistant',
    content: `Hi, I'm Hex.\n\nBring me anything — a market, a decision, a question you've been circling. I'll tell you what the data actually supports, and what the odds are.\n\nWhat's on your mind?`,
  };

  // Loading copy — only "Thinking..." for fast chat replies.
  // The slower web/engine narration only kicks in if the request is still
  // pending after 6s (i.e. it's actually doing the slow path).
  const SLOW_PATH_STEPS = [
    'Pulling fresh data from the web...',
    'Running the engine...',
    'Crunching probabilities...',
    'Finalizing the analysis...',
  ];

  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // null = show "Thinking..."; ≥0 = show SLOW_PATH_STEPS[index]
  const [slowStep, setSlowStep] = useState(null);
  const slowStartTimeoutRef = useRef(null);
  const slowIntervalRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [traderEnabled, setTraderEnabled] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const baseTextRef = useRef('');
  // Track in-flight requests so they survive tab switches / re-renders.
  const pendingRequestsRef = useRef([]);
  // Flag — true when the current input was produced by dictation, so we polish grammar before sending.
  const dictatedRef = useRef(false);
  // Hard lock to prevent double-firing the send (rapid Enter / double-tap).
  const sendingRef = useRef(false);
  // Ref mirror of speakingId so handleSpeak can be a stable useCallback.
  // Without this, the function gets a new reference every render and breaks
  // ChatMessage's React.memo — every keystroke re-renders all messages.
  const speakingIdRef = useRef(null);
  speakingIdRef.current = speakingId;

  const handleCopy = useCallback((message) => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSpeak = useCallback((message) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Audio playback is not supported in this browser. Try Chrome, Safari, or Edge.');
      return;
    }

    const synth = window.speechSynthesis;

    // Toggle off if already speaking this message
    if (speakingIdRef.current === message.id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }

    // Cancel any existing speech
    synth.cancel();

    // Strip markdown so the voice reads cleanly
    const cleanText = message.content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[•·]/g, '')
      .trim();

    if (!cleanText) return;

    // Speak as ONE utterance — chunking + queue chaining is what was breaking on mobile.
    // Most browsers handle long text fine; the queue pattern was failing because of cross-origin
    // iframe restrictions and the cancel/speak race condition.
    const u = new SpeechSynthesisUtterance(cleanText);
    u.rate = 0.95;
    u.pitch = 1;
    u.lang = 'en-US';
    u.onend = () => setSpeakingId(null);
    u.onerror = (e) => {
      console.error('Speech error:', e?.error || e);
      setSpeakingId(null);
    };

    setSpeakingId(message.id);
    // Direct speak() call within the click handler — preserves the user gesture for mobile.
    synth.speak(u);
  }, []);

  // Track whether the initial load from localStorage has completed.
  // Without this guard, the save effect fires on mount BEFORE the load
  // effect's setConversations takes effect, overwriting saved history
  // with the default [welcomeMessage] — if the component unmounts in
  // that brief window (e.g. auth redirect), conversations are lost.
  const conversationsLoadedRef = useRef(false);

  // Load conversations on mount or initialize default
  useEffect(() => {
    const saved = localStorage.getItem('hex6_conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sanitized = parsed.map(c => {
          let messages = (c.messages || []).map(m =>
            typeof m?.content === 'string'
              ? { ...m, content: m.content.replace(/Evrica Intelligence/g, 'HEX [PI]') }
              : m
          );
          if (messages[0]?.role === 'assistant' && messages[0]?.content !== welcomeMessage.content) {
            messages = [welcomeMessage, ...messages.slice(1)];
          }
          return { ...c, messages };
        });
        setConversations(sanitized);
        if (sanitized.length > 0) {
          setCurrentConversationId(sanitized[0].id);
        }
      } catch (err) {
        console.log('Could not load saved conversations');
      }
    } else {
      const defaultConv = {
        id: Date.now().toString(),
        title: 'Chat',
        messages: [welcomeMessage],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setConversations([defaultConv]);
      setCurrentConversationId(defaultConv.id);
      setMessages([welcomeMessage]);
    }
    conversationsLoadedRef.current = true;
  }, []);

  // Save conversations to localStorage whenever they change — but only
  // AFTER the initial load has completed, so we never overwrite saved
  // history with the default welcome state.
  useEffect(() => {
    if (!conversationsLoadedRef.current) return;
    if (conversations.length > 0) {
      localStorage.setItem('hex6_conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // Load conversation messages ONLY when the user explicitly switches conversations.
  // We intentionally DO NOT depend on `conversations` here — otherwise every save
  // would overwrite the live message list and wipe the user's just-sent message.
  useEffect(() => {
    if (currentConversationId) {
      const conv = conversations.find((c) => c.id === currentConversationId);
      if (conv?.messages) {
        setMessages(conv.messages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let dictated = '';
        for (let i = 0; i < event.results.length; i++) {
          dictated += event.results[i][0].transcript;
        }
        dictated = dictated.trim();
        const base = baseTextRef.current;
        const finalText = base + (base && dictated ? ' ' : '') + dictated;
        console.log('[voice] transcript:', dictated, '| final input:', finalText);
        dictatedRef.current = true; // mark so we know to polish grammar on send
        setInput(finalText);
        Promise.resolve().then(() => setInput(finalText));
      };

      recognitionRef.current.onstart = () => {
        console.log('[voice] recognition started — mic is live');
      };

      recognitionRef.current.onaudiostart = () => {
        console.log('[voice] audio capture started');
      };

      recognitionRef.current.onerror = (event) => {
        setListening(false);
        console.warn('[voice] error:', event?.error, event);
      };

      recognitionRef.current.onend = () => {
        console.log('[voice] recognition ended');
        setListening(false);
      };
    }
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in this browser. Use Chrome, Safari, or Edge.');
      return;
    }

    if (listening) {
      try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
      setListening(false);
      return;
    }

    try {
      // Snapshot whatever is already in the input so dictation appends to it
      // instead of overwriting on each interim update.
      baseTextRef.current = input;
      setListening(true);
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[voice] start error:', err);
      setListening(false);
    }
  };



  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = res.file_url || res.data?.file_url;
      if (fileUrl) {
        setUploadedImage(fileUrl);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  };

  const handleSendMessage = async () => {
    // Hard guard against double-fires (rapid Enter, double-tap, etc.).
    // setLoading is async — using a ref is the only reliable lock.
    if (sendingRef.current) return;
    sendingRef.current = true;

    // If the mic is still listening, stop it so any pending dictation gets committed.
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      setListening(false);
    }

    // Read the latest input value — fall back to the DOM if React state is stale
    // (can happen right after dictation when state hasn't flushed yet).
    const textareaEl = document.querySelector('textarea[placeholder="Ask anything..."]');
    const liveValue = (textareaEl?.value ?? input).trim();

    if (!liveValue && !uploadedImage) {
      sendingRef.current = false;
      return;
    }

    // Polish grammar only for dictated input (saves the LLM call on typed messages).
    let polishedInput = liveValue;
    if (dictatedRef.current && liveValue.length > 0) {
      try {
        const polished = await base44.integrations.Core.InvokeLLM({
          prompt: `Fix grammar, punctuation, and capitalization for this dictated text. Keep the meaning and wording identical — only correct punctuation, capitalization, and obvious transcription errors. Return ONLY the corrected text, nothing else.\n\nText: "${liveValue}"`,
          model: CLAUDE_MODEL,
        });
        if (typeof polished === 'string' && polished.trim().length > 0) {
          polishedInput = polished.trim().replace(/^["']|["']$/g, '');
        }
      } catch (e) { /* fall back to raw input */ }
    }
    dictatedRef.current = false;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: polishedInput,
    };

    if (uploadedImage) {
      userMessage.file_urls = [uploadedImage];
    }

    const newMessages = [...messages, userMessage];
    const imageAtSend = uploadedImage;

    // Ensure there's always an active conversation so messages are persisted.
    // If we're on a fresh "New Chat" (no convId), spin one up now.
    // CRITICAL: we set the messages FIRST, then create the conversation, and we
    // intentionally do NOT call setCurrentConversationId here for new convos —
    // doing so would re-trigger the "load messages from conv" effect and race
    // with our setMessages call. We attach the convId via ref instead.
    setMessages(newMessages);

    let convIdAtSend = currentConversationId;
    if (!convIdAtSend) {
      convIdAtSend = Date.now().toString();
      const newConv = {
        id: convIdAtSend,
        title: polishedInput.slice(0, 40) || 'Chat',
        messages: newMessages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setConversations((prev) => [newConv, ...prev]);
      // Defer activating the new conv until AFTER the reply lands, so the
      // "load messages from conv" effect can't wipe our in-flight state.
    } else {
      // Persist the user's message immediately into the active conversation.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convIdAtSend
            ? { ...c, messages: newMessages, updated_at: new Date().toISOString() }
            : c
        )
      );
    }
    setInput('');
    setUploadedImage(null);
    setLoading(true);
    setSlowStep(null); // start with "Thinking..."
    // After 18s, if still pending, escalate to the slow-path narration.
    // Casual replies finish in ~10-12s and should never see the "pulling from web" message.
    // Only true analytical queries (web+engine, 25-40s) hit the narration.
    slowStartTimeoutRef.current = setTimeout(() => {
      setSlowStep(0);
      slowIntervalRef.current = setInterval(() => {
        setSlowStep((prev) => (prev == null ? 0 : Math.min(prev + 1, SLOW_PATH_STEPS.length - 1)));
      }, 5000);
    }, 18000);

    const payload = {
      message: polishedInput,
      conversationHistory: newMessages.filter(m => !m.isThinking).slice(-20),
      // Continuous awareness — Hex reads the same clock and place the user is in.
      clientContext: {
        localTime: new Date().toISOString(),
        localTimeReadable: new Date().toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
      },
    };
    if (imageAtSend) payload.file_urls = [imageAtSend];

    // Fire the request — completes even if the user switches tabs.
    const reqId = Date.now();
    const requestPromise = base44.functions.invoke('think', payload)
      .then((response) => {
        const replyText = response?.data?.response;
        if (!replyText) return;

        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: replyText,
        };

        // Always append to the visible message list — works whether or not a conversation is selected.
        setMessages((prev) => {
          if (prev.some((m) => m.id === assistantMessage.id)) return prev;
          return [...prev, assistantMessage];
        });

        // Persist assistant reply into the active conversation.
        if (convIdAtSend) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convIdAtSend
                ? {
                    ...c,
                    messages: [...newMessages, assistantMessage],
                    updated_at: new Date().toISOString(),
                  }
                : c
            )
          );
          // Now safe to activate the conv (reply already in state).
          setCurrentConversationId((cur) => cur || convIdAtSend);
          // First exchange → let Hex name the moment: a short read of where
          // this conversation is heading, stamped into the day rundown.
          if (newMessages.filter((m) => m.role === 'user').length === 1) {
            base44.integrations.Core.InvokeLLM({
              prompt: `Name this conversation in 3-5 words — your own read of where it's heading, not a summary of the words used. No quotes, no punctuation at the end.\n\nUser: ${polishedInput}\n\nYou: ${replyText.slice(0, 600)}`,
              model: CLAUDE_MODEL,
            }).then((t) => {
              const title = typeof t === 'string' ? t.trim().replace(/^["']|["']$/g, '').slice(0, 48) : '';
              if (title) {
                setConversations((prev) => prev.map((c) => (c.id === convIdAtSend ? { ...c, title } : c)));
              }
            }).catch(() => { /* keep the fallback title */ });
          }
        }
      })
      .catch((err) => {
        console.error('think request failed:', err);
        // Never leave the person looking at silence: say what happened.
        const status = err?.status ?? err?.response?.status;
        const content = status === 402
          ? 'Your subscription is not active, so I could not answer that. Reopen the app to restart it.'
          : status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'That did not go through on my end. Please send it again.';
        setMessages((prev) => [...prev, { id: `${Date.now()}-error`, role: 'assistant', content }]);
      })
      .finally(() => {
        clearTimeout(slowStartTimeoutRef.current);
        clearInterval(slowIntervalRef.current);
        setSlowStep(null);
        setLoading(false);
        sendingRef.current = false;
        pendingRequestsRef.current = pendingRequestsRef.current.filter((r) => r.id !== reqId);
      });

    pendingRequestsRef.current.push({ id: reqId, promise: requestPromise });
  };

  const handleNewChat = () => {
    setMessages([welcomeMessage]);
    setCurrentConversationId(null);
    setSidebarOpen(false);
  };

  const handleRenameConversation = (convId, newTitle) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, title: newTitle } : c
      )
    );
  };

  const handleSelectConversation = (convId) => {
    setCurrentConversationId(convId);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = (convId) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (currentConversationId === convId) {
      handleNewChat();
    }
  };

  const handleSignOut = async () => {
    await base44.auth.logout(window.location.origin + '/');
  };

  // Detect if mobile — reactive to window resize
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div className="app-shell flex h-screen bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-44 bg-card border-r border-border transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0`}
      >
        <div className="flex flex-col h-full p-2.5 pb-9 md:pb-10">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xs font-bold tracking-tight">Hex</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 hover:bg-muted rounded-sm text-sm flex items-center justify-center"
              style={{ minWidth: '28px', minHeight: '28px' }}
            >
              ×
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors mb-2.5"
            style={{ minHeight: '30px' }}
          >
            <Plus className="w-3 h-3" />
            New Chat
          </button>

          <div className="flex-1 overflow-y-auto mb-2.5">
            {conversations.length === 0 ? (
              <p className="text-[10px] text-secondary text-center py-3">No conversations yet.</p>
            ) : (
              <ConversationDayList
                conversations={conversations}
                currentConversationId={currentConversationId}
                onSelect={handleSelectConversation}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
              />
            )}
          </div>

          <SidebarActions
            onSettings={() => setSettingsOpen(true)}
            onLegal={() => setLegalOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-3 md:px-4 py-2 md:py-2.5 border-b border-border gap-2">
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 hover:bg-muted rounded-sm flex items-center justify-center"
              aria-label="Open menu"
              style={{ minWidth: '32px', minHeight: '32px' }}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-end gap-2">
            {traderEnabled && (
              <span className="text-[9px] md:text-[10px] text-accent px-1.5 py-0.5 rounded bg-accent/10 whitespace-nowrap">
                Trader: Coming Soon
              </span>
            )}
            <ChatClock />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-5 space-y-3 md:space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              copiedId={copiedId}
              speakingId={speakingId}
              onCopy={handleCopy}
              onSpeak={handleSpeak}
            />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="ml-2 bg-muted/60 text-foreground border border-foreground/20 px-3 py-2 text-[13px] text-secondary flex flex-col gap-1.5 max-w-xs">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" style={{ animation: 'bounce 1.2s infinite', animationDelay: '0s' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" style={{ animation: 'bounce 1.2s infinite', animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" style={{ animation: 'bounce 1.2s infinite', animationDelay: '0.4s' }} />
                </div>
                <span className="text-[11px] text-secondary/70 transition-all duration-500">{slowStep === null ? 'Thinking...' : SLOW_PATH_STEPS[slowStep]}</span>
              </div>
            </div>
          )}
          <style>{`
            @keyframes bounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-6px); opacity: 1; }
            }
          `}</style>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-3 md:px-4 py-2.5 md:py-3 bg-background">
          <div className="flex flex-col gap-2">
            {uploadedImage && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-2xl border border-accent/30">
                <Image className="w-4 h-4 text-accent" />
                <span className="text-xs text-secondary truncate">{uploadedImage.split('/').pop()}</span>
                <button
                  onClick={() => setUploadedImage(null)}
                  className="ml-auto text-secondary hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={handleVoiceInput}
              className={`p-2 rounded-full transition-colors shrink-0 flex items-center justify-center ${
                listening
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted text-secondary hover:text-foreground'
              }`}
              title={listening ? 'Stop listening' : 'Start voice input'}
              style={{ minWidth: '32px', minHeight: '32px' }}
            >
              <Mic className={`w-4 h-4 ${listening ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-muted text-secondary hover:text-foreground transition-colors shrink-0 flex items-center justify-center"
              title="Upload image"
              style={{ minWidth: '32px', minHeight: '32px' }}
            >
              <Image className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            <textarea
              value={input}
              onChange={(e) => { dictatedRef.current = false; setInput(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 px-3 py-1.5 rounded-2xl border-2 border-foreground/20 bg-background text-foreground placeholder-secondary text-[13px] md:text-sm focus:outline-none focus:border-accent resize-none max-h-28 overflow-y-auto"
              style={{ minHeight: '34px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || (!input.trim() && !listening && !uploadedImage)}
              className="p-2 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
              style={{ minWidth: '32px', minHeight: '32px' }}
            >
              <Send className="w-4 h-4" strokeWidth={1.5} />
            </button>
            </div>
          </div>
          <p className="text-[9px] text-secondary/70 px-1 mt-2 leading-relaxed">
            Hex is a probabilistic intelligence model. No information provided constitutes financial, legal, or professional advice.
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        traderEnabled={traderEnabled}
        onTraderToggle={setTraderEnabled}
      />

      {/* Legal Modal */}
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
    </div>
  );
}