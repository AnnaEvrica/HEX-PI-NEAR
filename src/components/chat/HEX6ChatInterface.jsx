import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Upload, Menu, Settings, LogOut, Plus, MessageCircle, Zap, Mic, MicOff, BookOpen, X, Image, Copy, Check, Volume2, VolumeX, CreditCard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SettingsModal from '@/components/SettingsModal';
import LegalModal from '@/components/LegalModal';
import ConversationItem from '@/components/chat/ConversationItem';
import ThinkingModeToggle from '@/components/chat/ThinkingModeToggle';

export default function HEX6ChatInterface() {
  const welcomeMessage = {
    id: 'welcome',
    role: 'assistant',
    content: `Welcome. I am Evrica Intelligence — one mind with two ways of thinking.\n\n**Reason** asks what is possible. **Understand** asks what is meaningful. Both draw from the same knowledge; the mode only changes how I think, never what I know.\n\nWhat would you like to explore?`,
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
  const [thinkingMode, setThinkingMode] = useState('understand');
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

  const handleCopy = (message) => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (message) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Audio playback is not supported in this browser. Try Chrome, Safari, or Edge.');
      return;
    }

    const synth = window.speechSynthesis;

    // Toggle off if already speaking this message
    if (speakingId === message.id) {
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
  };

  // Load conversations on mount or initialize default
  useEffect(() => {
    const saved = localStorage.getItem('hex6_conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
        if (parsed.length > 0) {
          setCurrentConversationId(parsed[0].id);
        }
      } catch (err) {
        console.log('Could not load saved conversations');
      }
    } else {
      // Create default conversation if none exist
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
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
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
          model: 'gemini_3_flash',
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

    // Get user preferences from localStorage
    const prefs = JSON.parse(localStorage.getItem('hex6_user_prefs') || '{}');
    const payload = {
      message: polishedInput,
      conversationHistory: newMessages.filter(m => !m.isThinking).slice(-20),
      analyticalDepth: prefs.analyticalDepth || 'executive',
      riskAversion: prefs.riskAversion || 2.5,
      thinking_mode: thinkingMode,
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
        }
      })
      .catch((err) => {
        console.error('hex6Chat request failed:', err);
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

  const handleManageBilling = async () => {
    try {
      const res = await base44.functions.invoke('manageBilling', {});
      if (res.data?.url) window.location.href = res.data.url;
    } catch (err) {
      console.error('Billing portal failed:', err);
    }
  };

  // Detect if mobile — reactive to window resize
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0`}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold">Evrica</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-muted rounded-sm"
            >
              ×
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors mb-4"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {conversations.length === 0 ? (
              <p className="text-xs text-secondary text-center py-4">No conversations yet. Start a chat!</p>
            ) : (
              conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={currentConversationId === conv.id}
                  onSelect={() => handleSelectConversation(conv.id)}
                  onRename={(newTitle) => handleRenameConversation(conv.id, newTitle)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                />
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-muted rounded-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => setLegalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-muted rounded-sm transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Legal
            </button>
            <button
              onClick={handleManageBilling}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-muted rounded-sm transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-muted rounded-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-3 md:px-6 py-3 md:py-4 border-b border-border gap-2">
          <div className="flex items-center w-10 md:w-0 shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-muted rounded-sm flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex justify-center">
            <ThinkingModeToggle mode={thinkingMode} onChange={setThinkingMode} />
          </div>
          <div className="flex items-center justify-end w-10 md:w-auto shrink-0">
            {traderEnabled && (
              <span className="text-[10px] md:text-xs text-accent px-2 py-1 rounded bg-accent/10 whitespace-nowrap">
                Trader: Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-8 space-y-4 md:space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex group ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`max-w-[85%] md:max-w-2xl ${message.role === 'user' ? 'mr-2' : 'ml-2'}`}>
                {message.file_urls && message.file_urls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {message.file_urls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="uploaded"
                        className="max-w-xs rounded-lg border border-border"
                      />
                    ))}
                  </div>
                )}
                <div
                  className={`${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-2xl rounded-tl-sm'
                  } px-4 py-2.5 text-sm md:text-base`}
                >
                  <ReactMarkdown 
                    className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-0 [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0"
                    components={{
                      p: ({ node, ...props }) => <p {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside" {...props} />,
                      li: ({ node, ...props }) => <li {...props} />,
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline hover:opacity-80 break-all"
                        />
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>

                {/* Action buttons — sit under the bubble, only show on hover (or always on touch devices) */}
                <div className={`flex gap-0.5 mt-1 px-1 opacity-60 hover:opacity-100 transition-opacity ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <button
                    onClick={() => handleCopy(message)}
                    className="p-1.5 rounded-md hover:bg-muted text-secondary hover:text-foreground transition-colors"
                    title="Copy message"
                  >
                    {copiedId === message.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleSpeak(message)}
                      className={`p-1.5 rounded-md hover:bg-muted transition-colors ${speakingId === message.id ? 'text-accent' : 'text-secondary hover:text-foreground'}`}
                      title={speakingId === message.id ? 'Stop speaking' : 'Read aloud'}
                    >
                      {speakingId === message.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="ml-2 bg-muted text-foreground rounded-lg rounded-tl-sm px-4 py-3 text-sm text-secondary flex flex-col gap-2 max-w-xs">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-secondary" style={{ animation: 'bounce 1.2s infinite', animationDelay: '0s' }} />
                  <div className="w-2 h-2 rounded-full bg-secondary" style={{ animation: 'bounce 1.2s infinite', animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full bg-secondary" style={{ animation: 'bounce 1.2s infinite', animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs text-secondary/70 transition-all duration-500">{slowStep === null ? 'Thinking...' : SLOW_PATH_STEPS[slowStep]}</span>
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
        <div className="border-t border-border px-3 md:px-6 py-3 md:py-4 bg-background">
          <div className="flex flex-col gap-2 md:gap-3">
            {uploadedImage && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-sm border border-accent/30">
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
              className={`p-2 md:p-2.5 rounded-sm transition-colors shrink-0 flex items-center justify-center ${
                listening
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted text-secondary hover:text-foreground'
              }`}
              title={listening ? 'Stop listening' : 'Start voice input'}
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Mic className={`w-4 md:w-5 h-4 md:h-5 ${listening ? 'animate-pulse' : ''}`} />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 md:p-2.5 rounded-sm hover:bg-muted text-secondary hover:text-foreground transition-colors shrink-0 flex items-center justify-center"
              title="Upload image"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Image className="w-4 md:w-5 h-4 md:h-5" />
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
              className="flex-1 px-2 md:px-4 py-2 rounded-sm border border-border bg-background text-foreground placeholder-secondary text-sm md:text-base focus:outline-none focus:border-accent resize-none max-h-32 overflow-y-auto"
              style={{ minHeight: '44px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || (!input.trim() && !listening && !uploadedImage)}
              className="p-2 md:p-2.5 rounded-sm bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Send className="w-4 md:w-5 h-4 md:h-5" />
            </button>
            </div>
          </div>
          <p className="text-[11px] text-secondary/70 px-1 mt-3 md:mt-4 leading-relaxed">
            Evrica Intelligence is a probabilistic intelligence model. No information provided constitutes financial, legal, or professional advice.
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