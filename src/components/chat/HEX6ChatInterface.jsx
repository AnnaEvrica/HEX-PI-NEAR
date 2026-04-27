import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Upload, Menu, Settings, LogOut, Plus, MessageCircle, Zap, Mic, MicOff, BookOpen, X, Image } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import CalibrationPanel from '@/components/CalibrationPanel';
import SettingsModal from '@/components/SettingsModal';
import LegalModal from '@/components/LegalModal';
import ConversationItem from '@/components/chat/ConversationItem';

export default function HEX6ChatInterface() {
  const welcomeMessage = {
    id: 'welcome',
    role: 'assistant',
    content: `Welcome to HEX6 Oracle. I'm a probabilistic allocation intelligence system trained to analyze market behavior and guide you toward better portfolio decisions.\n\nI don't give advice. I generate probability-weighted exposure recommendations based on data.\n\nWhat markets are you thinking about?`,
  };

  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [traderEnabled, setTraderEnabled] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    const saved = localStorage.getItem('hex6_conversations');
    if (saved) {
      try {
        setConversations(JSON.parse(saved));
      } catch (err) {
        console.log('Could not load saved conversations');
      }
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('hex6_conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // Load conversation messages when selected
  useEffect(() => {
    if (currentConversationId) {
      const conv = conversations.find((c) => c.id === currentConversationId);
      if (conv?.messages) {
        setMessages(conv.messages);
      }
    }
  }, [currentConversationId, conversations]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
        setListening(false);
      };

      recognitionRef.current.onerror = () => {
        setListening(false);
      };

      recognitionRef.current.onend = () => {
        setListening(false);
      };
    }
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setListening(true);
      recognitionRef.current.start();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    try {
      console.log('Uploading file:', file.name);
      const res = await base44.integrations.Core.UploadFile({ file });
      console.log('Upload response:', res);
      if (res.data?.file_url) {
        setUploadedImage(res.data.file_url);
        console.log('Image uploaded successfully');
      } else {
        console.error('No file_url in response:', res);
      }
    } catch (err) {
      console.error('Image upload failed:', err.message || err);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setUploadedImage(null);
    setLoading(true);

    try {
      // Get user preferences from localStorage
      const prefs = JSON.parse(localStorage.getItem('hex6_user_prefs') || '{}');
      
      const payload = {
        message: input,
        conversationHistory: newMessages,
        analyticalDepth: prefs.analyticalDepth || 'executive',
        riskAversion: prefs.riskAversion || 2.5,
      };

      // Add image if uploaded
      if (uploadedImage) {
        payload.file_urls = [uploadedImage];
      }

      const response = await base44.functions.invoke('hex6Chat', payload);

      if (response.data?.error) throw new Error(response.data.error);

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data?.response || 'Unable to process your request.',
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Auto-save to conversation
      if (currentConversationId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? { ...c, messages: updatedMessages, updated_at: new Date().toISOString() }
              : c
          )
        );
      } else {
        // Create new conversation if none selected
        const title = input.substring(0, 30) + (input.length > 30 ? '...' : '');
        const newConv = {
          id: Date.now().toString(),
          title,
          messages: updatedMessages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
      }
    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error processing your message. Please try again.',
      };
      const updatedMessages = [...newMessages, errorMsg];
      setMessages(updatedMessages);
    } finally {
      setLoading(false);
    }
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

  // Detect if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className={`flex ${isMobile ? 'flex-col' : ''} h-screen bg-background`}>
      {/* Sidebar - hidden on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0`}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold">HEX6</h1>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-muted rounded-sm"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-center flex-1 font-medium text-sm text-secondary">
            HEX6 BLE : ORACLE
          </h2>
          {traderEnabled && (
            <span className="text-xs text-accent px-2 py-1 rounded bg-accent/10">
              Trader: Coming Soon
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-8 space-y-4 md:space-y-6">
          {/* Calibration Panel */}
          <div className="w-full">
            <CalibrationPanel messageCount={messages.length} />
          </div>

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`w-full sm:max-w-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-lg rounded-tr-sm mr-2'
                    : 'bg-muted text-foreground rounded-lg rounded-tl-sm ml-2'
                } px-3 md:px-4 py-2 md:py-3 text-sm md:text-base`}
              >
                <ReactMarkdown 
                  className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-0 [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0"
                  components={{
                    p: ({ node, ...props }) => <p {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside" {...props} />,
                    li: ({ node, ...props }) => <li {...props} />,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse animation-delay-100" />
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse animation-delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-3 md:px-6 py-3 md:py-4 bg-background">
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
              {listening ? <Mic className="w-4 md:w-5 h-4 md:h-5" /> : <MicOff className="w-4 md:w-5 h-4 md:h-5" />}
            </button>

            <label className="p-2 md:p-2.5 rounded-sm hover:bg-muted text-secondary hover:text-foreground cursor-pointer transition-colors shrink-0 flex items-center justify-center" title="Upload image" style={{ minWidth: '44px', minHeight: '44px' }}>
              <Image className="w-4 md:w-5 h-4 md:h-5" />
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask HEX6..."
              className="flex-1 px-2 md:px-4 py-2 rounded-sm border border-border bg-background text-foreground placeholder-secondary text-sm md:text-base focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || loading}
              className="p-2 md:p-2.5 rounded-sm bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Send className="w-4 md:w-5 h-4 md:h-5" />
            </button>
          </div>
          <p className="text-xs text-secondary px-1">
            HEX6 BLE is a probabilistic intelligence model. No information provided constitutes financial, legal, or professional advice.
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