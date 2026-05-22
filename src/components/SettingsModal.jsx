import { useState, useEffect } from 'react';
import { X, LogOut as LogOutIcon, Copy, Download, Lock, Key, Shield, Eye, Clock, Bell, TrendingUp, Zap, AlertTriangle, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function generateSystemID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'HEX-USER-';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default function SettingsModal({ open, onClose }) {
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [systemID, setSystemID] = useState(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [modelTraining, setModelTraining] = useState(true);
  const [analyticalDepth, setAnalyticalDepth] = useState('executive');
  const [riskAversion, setRiskAversion] = useState(2.5);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [consentTimestamp, setConsentTimestamp] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        
        // Load or generate system ID
        const stored = localStorage.getItem('hex6_system_id');
        if (stored) {
          setSystemID(stored);
        } else {
          const newID = generateSystemID();
          setSystemID(newID);
          localStorage.setItem('hex6_system_id', newID);
        }

        // Load user preferences
        const prefs = localStorage.getItem('hex6_user_prefs');
        if (prefs) {
          const p = JSON.parse(prefs);
          setAnalyticalDepth(p.analyticalDepth || 'executive');
          setRiskAversion(p.riskAversion || 2.5);
          setBaseCurrency(p.baseCurrency || 'USD');
          setModelTraining(p.modelTraining !== false);
        }

        // Get consent timestamp
        const timestamp = localStorage.getItem('hex6_consent_timestamp');
        if (timestamp) {
          setConsentTimestamp(timestamp);
        }
      } catch (err) {
        console.log('Could not load user data');
      }
    };
    loadUserData();
  }, []);

  const savePreferences = (prefs) => {
    localStorage.setItem('hex6_user_prefs', JSON.stringify(prefs));
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    try {
      // Contact support for password reset
      window.open('mailto:support@evrica.tech?subject=Password%20Reset%20Request', '_blank');
    } finally {
      setLoading(false);
    }
  };

  const handleDataExport = async () => {
    setLoading(true);
    try {
      // Get conversations from localStorage
      const conversations = JSON.parse(localStorage.getItem('hex6_conversations') || '[]');
      
      // Format data for export
      const chatHistory = conversations.map(conv => ({
        title: conv.title,
        created: conv.created_at,
        messages: conv.messages.length,
        lastUpdate: conv.updated_at,
      }));

      const exportData = {
        user: user?.email,
        systemID,
        exportedAt: new Date().toISOString(),
        totalConversations: conversations.length,
        conversations: chatHistory,
      };
      
      const csv = ['User,System ID,Exported At,Total Conversations\n', 
        `${exportData.user},${exportData.systemID},${exportData.exportedAt},${exportData.totalConversations}\n`,
        '\nConversation History\n',
        'Title,Created,Message Count,Last Updated\n',
        ...chatHistory.map(c => `"${c.title}",${c.created},${c.messages},${c.lastUpdate}`)
      ].join('');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hex6-data-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await base44.auth.logout('/');
    } catch (err) {
      setMessage({ type: 'error', text: 'Logout failed' });
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">Account Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {[
            { id: 'account', label: 'Account' },
            { id: 'parameters', label: 'Parameters' },
            { id: 'legal', label: 'Legal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-secondary hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {message && (
            <div className={`p-3 rounded-sm text-sm ${
              message.type === 'success'
                ? 'bg-green-950/30 border border-green-900/50 text-green-200'
                : 'bg-red-950/30 border border-red-900/50 text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* ACCOUNT */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              {/* Profile */}
              {user && (
                <div className="p-6 border border-border rounded-sm space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                      {user.full_name?.[0] || user.email?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold">{user.full_name || 'User'}</p>
                      <p className="text-sm text-secondary">{user.email}</p>
                    </div>
                  </div>

                  {/* System ID */}
                  <div className="space-y-2 pt-4 border-t border-border">
                    <p className="text-xs text-secondary font-medium uppercase tracking-wide">System ID</p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-sm font-mono text-sm">
                      <span>{systemID}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(systemID);
                          setMessage({ type: 'success', text: 'System ID copied.' });
                        }}
                        className="p-1 hover:bg-border rounded transition-colors"
                      >
                        <Copy className="w-4 h-4 text-secondary" />
                      </button>
                    </div>
                  </div>

                  {/* Account Genesis */}
                  <div className="space-y-2">
                    <p className="text-xs text-secondary font-medium uppercase tracking-wide">Account Genesis</p>
                    <p className="text-sm text-foreground">System accessed since {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              )}

              {/* SECURITY */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wide">Security</h3>

                {/* Password Reset */}
                <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Key className="w-4 h-4" />
                    Password Management
                  </div>
                  <button
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    Reset Password
                  </button>
                </div>

                {/* 2FA */}
                <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <label className="text-sm font-medium">Two-Factor Authentication</label>
                    </div>
                    <button
                      onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        twoFAEnabled ? 'bg-accent' : 'bg-border'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                          twoFAEnabled ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-secondary">{twoFAEnabled ? '✓ Enabled' : 'Add a second authentication layer'}</p>
                </div>

                </div>

              {/* Data Export - at the very end */}
              <div className="pt-6 border-t border-border space-y-4 mt-8">
                <h3 className="text-sm font-bold uppercase tracking-wide">Data Export</h3>
                <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Download className="w-4 h-4" />
                    Export History
                  </div>
                  <button
                    onClick={handleDataExport}
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-sm border border-border hover:bg-muted text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    Download Chat & Analysis History (CSV)
                  </button>
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full px-4 py-3 rounded-sm border border-destructive/50 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 mt-8"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* PARAMETERS */}
          {activeSection === 'parameters' && (
            <div className="space-y-6">
              <p className="text-sm text-secondary">Customize how HEX6 responds to you.</p>

              {/* Analytical Depth */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-4">
                <p className="text-sm font-medium">Analytical Depth</p>
                <div className="space-y-2">
                  {[
                    { id: 'executive', label: 'Executive Summary', desc: 'Plain English, high-level strategy' },
                    { id: 'deep', label: 'Deep Quant', desc: 'Raw μ math, variance metrics, Kelly fractions' },
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="depth"
                        value={opt.id}
                        checked={analyticalDepth === opt.id}
                        onChange={(e) => {
                          setAnalyticalDepth(e.target.value);
                          savePreferences({ analyticalDepth: e.target.value, riskAversion, baseCurrency, modelTraining });
                        }}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-secondary">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Output Risk Tolerance */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Output Risk Confidence</p>
                  <span className="text-lg font-bold text-accent">{riskAversion.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={riskAversion}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRiskAversion(val);
                    savePreferences({ analyticalDepth, riskAversion: val, baseCurrency, modelTraining });
                  }}
                  className="w-full accent-accent"
                />
                <p className="text-xs text-secondary">
                  <strong>1–2:</strong> High-conviction, aggressive probability outputs emphasizing upside potential.{' '}
                  <strong>2–3:</strong> Balanced analysis with both bullish and bearish scenarios.{' '}
                  <strong>3–5:</strong> Conservative outputs prioritizing downside protection and caution.
                </p>
              </div>

              {/* Base Currency */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <p className="text-sm font-medium">Base Currency Display</p>
                <select
                  value={baseCurrency}
                  onChange={(e) => {
                    setBaseCurrency(e.target.value);
                    savePreferences({ analyticalDepth, riskAversion, baseCurrency: e.target.value, modelTraining });
                  }}
                  className="w-full px-3 py-2 rounded-sm border border-border bg-black/20 text-sm text-white"
                >
                  {['USD', 'EUR', 'USDC'].map((c) => (
                    <option key={c} value={c} className="bg-black">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* LEGAL */}
          {activeSection === 'legal' && (
            <div className="space-y-6">
              {/* System Role */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border">
                <p className="text-sm font-medium mb-2">System Role Status</p>
                <p className="text-sm text-secondary">HEX6 is an analytics engine. Not a fiduciary or advisor.</p>
              </div>

              {/* Active Consents */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-4">
                <p className="text-sm font-bold">Active Consents</p>

                <div className="space-y-3">
                  {/* Data Processing - Locked */}
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded-sm">
                    <div>
                      <p className="text-sm font-medium">Data Processing</p>
                      <p className="text-xs text-secondary">Required to run the chat</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent" />
                      <span className="text-xs text-secondary">ON</span>
                    </div>
                  </div>

                  {/* Model Training - Toggleable */}
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded-sm">
                    <div>
                      <p className="text-sm font-medium">Model Training</p>
                      <p className="text-xs text-secondary">Allow your chat data to train our AI</p>
                    </div>
                    <button
                      onClick={() => {
                        setModelTraining(!modelTraining);
                        savePreferences({ analyticalDepth, riskAversion, baseCurrency, modelTraining: !modelTraining });
                      }}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        modelTraining ? 'bg-accent' : 'bg-border'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                          modelTraining ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Legal Disclosures */}
              <div className="space-y-3">
                <p className="text-sm font-bold">Legal Disclosures</p>
                {[
                  { title: 'Risk & Model Disclosure v1.2', content: 'Trading and investing involve substantial risk of loss. HEX6 models are probabilistic and may be incorrect.' },
                  { title: 'Terms of Use v1.2', content: 'By using HEX6 BLE, you agree to our terms of service and acknowledge you are responsible for all investment decisions.' },
                  { title: 'Privacy Policy v1.2', content: 'Your data is encrypted and stored securely. We do not sell personal information to third parties.' },
                ].map((doc, i) => (
                  <details key={i} className="p-3 bg-muted/30 rounded-sm border border-border cursor-pointer group">
                    <summary className="font-medium text-sm flex items-center justify-between">
                      {doc.title}
                      <span className="text-secondary group-open:hidden">▶</span>
                      <span className="text-secondary group-open:block hidden">▼</span>
                    </summary>
                    <p className="text-xs text-secondary mt-3 leading-relaxed">{doc.content}</p>
                  </details>
                ))}
              </div>

              {/* Consent Timestamp */}
              {consentTimestamp && (
                <div className="p-4 bg-accent/5 rounded-sm border border-accent/30 text-center">
                  <p className="text-xs text-secondary">
                    Consents accepted on {new Date(consentTimestamp).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Los_Angeles',
                    })}{' '}
                    PDT
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm border border-border hover:bg-muted transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}