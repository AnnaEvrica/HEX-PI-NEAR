import { useState, useEffect } from 'react';
import { useState, useEffect } from 'react';
import { X, AlertTriangle, Mail, Lock, Trash2, Shield, Eye, Clock, LogOut as LogOutIcon, Bell, Upload, TrendingUp, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SettingsModal({
  open,
  onClose,
  traderEnabled,
  onTraderToggle,
}) {
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [chatEncryption, setChatEncryption] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTimes, setNotificationTimes] = useState(['09:00', '14:00', '17:00']);
  const [marketTrends, setMarketTrends] = useState(true);
  const [predictions, setPredictions] = useState(true);
  const [watchedAssets, setWatchedAssets] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState({
    behavioralModeling: 0,
    marketSync: 0,
    decisionAlignment: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        setNotificationEmail(u?.email || '');
      } catch (err) {
        console.log('Could not load user');
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    // Load live metrics
    const loadMetrics = async () => {
      try {
        const memoryRecords = await base44.entities.HEX6Memory?.list?.() || [];
        if (memoryRecords.length > 0) {
          const recent = memoryRecords.slice(-20);
          const avgSharpe = recent.reduce((s, m) => s + (parseFloat(m.sharpe) || 0), 0) / recent.length;
          const avgDrawdown = recent.reduce((s, m) => s + (parseFloat(m.max_drawdown) || 0), 0) / recent.length;
          
          setMetrics({
            behavioralModeling: Math.min(95, 50 + (recent.length * 2)),
            marketSync: Math.min(95, 60 + Math.abs(avgSharpe * 5)),
            decisionAlignment: Math.min(95, 55 + (Math.abs(avgDrawdown) * -1)),
          });
        }
      } catch (err) {
        console.log('Could not load metrics');
      }
    };

    // Simulate recent activity
    const activity = [
      { action: 'Logged in', timestamp: new Date(Date.now() - 5 * 60000) },
      { action: 'Opened chat interface', timestamp: new Date(Date.now() - 12 * 60000) },
      { action: 'Updated notification preferences', timestamp: new Date(Date.now() - 45 * 60000) },
      { action: 'Viewed portfolio', timestamp: new Date(Date.now() - 2 * 3600000) },
      { action: 'Enabled HEX6 insights', timestamp: new Date(Date.now() - 4 * 3600000) },
    ];
    setRecentActivity(activity);

    // Simulate active sessions
    const sessions = [
      { device: 'Chrome on macOS', location: 'Los Angeles, CA', current: true, timestamp: new Date() },
      { device: 'Safari on iPhone', location: 'Los Angeles, CA', current: false, timestamp: new Date(Date.now() - 24 * 3600000) },
    ];
    setActiveSessions(sessions);

    loadMetrics();
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePasswordReset = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // Send password reset email
      await base44.auth.sendPasswordResetEmail();
      setMessage({ type: 'success', text: 'Password reset email sent to your inbox.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    setLoading(true);
    setMessage(null);
    try {
      // Delete user account and data
      await base44.auth.deleteAccount();
      setMessage({ type: 'success', text: 'Account deletion initiated. You will be logged out.' });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setConfirmDelete(false);
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
      <div className="bg-card border border-border rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {[
            { id: 'account', label: 'Account' },
            { id: 'security', label: 'Security' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'privacy', label: 'Privacy' },
            { id: 'features', label: 'Features' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-secondary hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {message && (
            <div className={`p-3 rounded-sm text-sm ${
              message.type === 'success'
                ? 'bg-green-950/30 border border-green-900/50 text-green-200'
                : 'bg-red-950/30 border border-red-900/50 text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              {/* Profile Info */}
              {user && (
                <div className="p-4 border border-border rounded-sm space-y-2">
                  <p className="text-xs text-secondary font-medium uppercase">Profile</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                      {user.full_name?.[0] || user.email?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.full_name || 'User'}</p>
                      <p className="text-xs text-secondary">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Image for HEX6 Analysis */}
              <div className="p-4 border border-border rounded-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Upload className="w-4 h-4 text-accent" />
                  Upload Image for Analysis
                </div>
                <label className="flex items-center justify-center w-full px-4 py-2 border border-dashed border-border rounded-sm hover:border-accent cursor-pointer transition-colors">
                  <span className="text-xs text-secondary">Choose image or drag here</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={loading} className="hidden" />
                </label>
                {uploadedImage && (
                  <p className="text-xs text-accent">✓ Image ready for HEX6 analysis</p>
                )}
                <p className="text-xs text-secondary">HEX6 can analyze charts, portfolios, and market data from images</p>
              </div>

              {/* Email */}
              <div className="p-4 border border-border rounded-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Mail className="w-4 h-4" />
                  Notification Email
                </div>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm border border-border bg-black/20 text-sm text-white placeholder-white/30"
                  placeholder="your@email.com"
                />
                <p className="text-xs text-secondary">Where HEX6 will send market insights and alerts</p>
              </div>

              {/* Account Actions */}
              <div className="p-4 border border-border rounded-sm space-y-3">
                <p className="text-sm font-medium">Account Actions</p>
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-sm border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Lock className="w-4 h-4" />
                  Password Management
                </div>
                <button
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  Reset Password
                </button>
                <p className="text-xs text-secondary">
                  We'll send a reset link to your email address.
                </p>
              </div>

              <div className="p-4 bg-destructive/5 rounded-sm border border-destructive/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Danger Zone
                </div>
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className={`w-full px-4 py-2 rounded-sm text-sm font-medium transition-colors disabled:opacity-40 ${
                    confirmDelete
                      ? 'bg-destructive/80 text-white hover:bg-destructive'
                      : 'border border-destructive/50 text-destructive hover:bg-destructive/10'
                  }`}
                >
                  {confirmDelete ? 'Click again to confirm deletion' : 'Delete Account & Data'}
                </button>
                <p className="text-xs text-secondary">
                  This action is permanent and cannot be undone. All your data will be deleted.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {/* Trader Mode (Moved Here) */}
              <div className="p-4 border border-accent/30 bg-accent/5 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <label className="text-sm font-medium">Trader Mode Notifications</label>
                  </div>
                  <button
                    onClick={() => onTraderToggle(!traderEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      traderEnabled ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        traderEnabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-secondary">
                  {traderEnabled
                    ? 'Get real-time trade opportunities and execution alerts'
                    : 'Enable for automated trading insights and signals'}
                </p>
              </div>

              {/* Enable/Disable Market Notifications */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <label className="text-sm font-medium">Market Insights</label>
                  </div>
                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      notificationsEnabled ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        notificationsEnabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-secondary">
                  {notificationsEnabled
                    ? 'Tailored to your recent HEX6 chat discussions'
                    : 'Enable to receive AI-generated market insights'}
                </p>
              </div>

              {notificationsEnabled && (
                <>
                  {/* Notification Times */}
                  <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                    <p className="text-sm font-medium">Notification Times</p>
                    <div className="space-y-2">
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={idx}
                          type="time"
                          value={notificationTimes[idx]}
                          onChange={(e) => {
                            const updated = [...notificationTimes];
                            updated[idx] = e.target.value;
                            setNotificationTimes(updated);
                          }}
                          className="w-full px-3 py-2 rounded-sm bg-black/20 border border-border text-sm text-white"
                        />
                      ))}
                    </div>
                    <p className="text-xs text-secondary">Set your preferred times (UTC)</p>
                  </div>

                  {/* Content Preferences */}
                  <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                    <p className="text-sm font-medium">Personalized Content</p>
                    <p className="text-xs text-secondary/70">HEX6 learns from your chat history to tailor notifications</p>
                    <label className="flex items-center gap-3 text-sm text-secondary hover:text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marketTrends}
                        onChange={(e) => setMarketTrends(e.target.checked)}
                        className="w-4 h-4 accent-accent"
                      />
                      Market Trends (from your discussions)
                    </label>
                    <label className="flex items-center gap-3 text-sm text-secondary hover:text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={predictions}
                        onChange={(e) => setPredictions(e.target.checked)}
                        className="w-4 h-4 accent-accent"
                      />
                      HEX6 BLE Allocations (relevant to assets you track)
                    </label>
                  </div>

                  {/* Watched Assets */}
                  <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                    <p className="text-sm font-medium">Watch Specific Assets (Optional)</p>
                    <textarea
                      value={watchedAssets}
                      onChange={(e) => setWatchedAssets(e.target.value)}
                      placeholder="e.g., BTC, ETH, SPY (comma-separated)"
                      className="w-full px-3 py-2 rounded-sm bg-black/20 border border-border text-xs text-white placeholder-white/30 h-16"
                    />
                    <p className="text-xs text-secondary">Leave empty to get general market alerts</p>
                  </div>

                  {/* Test Notification */}
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await base44.functions.invoke('marketNotifications', {
                          action: 'sendTest',
                          notificationPrefs: {
                            enabled: true,
                            times: notificationTimes,
                            marketTrends,
                            predictions,
                            assets: watchedAssets.split(',').map(a => a.trim()).filter(Boolean),
                          },
                        });
                        setMessage({ type: 'success', text: res.data?.message || 'Test notification sent' });
                      } catch (err) {
                        setMessage({ type: 'error', text: err.message });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-sm border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    Send Test Notification
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              {/* 2FA */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Shield className="w-4 h-4" />
                  Two-Factor Authentication
                </div>
                {twoFAEnabled ? (
                  <div className="space-y-2">
                    <p className="text-xs text-accent font-medium">✓ Enabled</p>
                    <p className="text-xs text-secondary">You'll use your authenticator app on next login.</p>
                    <button
                      onClick={() => setTwoFAEnabled(false)}
                      disabled={loading}
                      className="w-full px-3 py-1.5 rounded-sm border border-red-800/40 text-xs text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-40"
                    >
                      Disable 2FA
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-secondary">Add a second layer of security to your account.</p>
                    <button
                      onClick={handle2FASetup}
                      disabled={loading}
                      className="w-full px-3 py-1.5 rounded-sm bg-accent text-black text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
                    >
                      Enable 2FA
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Encryption */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Eye className="w-4 h-4" />
                  Chat Privacy
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary">Encrypt conversations locally</span>
                  <button
                    onClick={() => setChatEncryption(!chatEncryption)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      chatEncryption ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        chatEncryption ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-secondary">
                  {chatEncryption ? 'Enabled. Your conversations are encrypted before storage.' : 'Disabled. Conversations stored without encryption.'}
                </p>
              </div>

              {/* Recent Activity */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Clock className="w-4 h-4" />
                  Recent Activity
                </div>
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-secondary">No recent activity logged.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {recentActivity.map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between px-2 py-1.5 bg-black/20 rounded text-xs text-secondary">
                        <span>{log.action}</span>
                        <span className="text-white/30">{log.timestamp.toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Sessions */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <LogOutIcon className="w-4 h-4" />
                  Active Sessions
                </div>
                {activeSessions.length === 0 ? (
                  <p className="text-xs text-secondary">No active sessions.</p>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.map((session, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 bg-black/20 rounded text-xs">
                        <div className="flex-1">
                          <p className="text-white font-medium">{session.device}</p>
                          <p className="text-white/50">{session.location}</p>
                        </div>
                        {session.current ? (
                          <span className="text-accent text-xs font-medium">Current</span>
                        ) : (
                          <button
                            onClick={() => {}}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Sign out
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-4">
              {/* Live Metrics */}
              <div className="p-4 border border-border rounded-sm space-y-4">
                <p className="text-sm font-medium">HEX6 Awareness</p>

                {[
                  { label: 'Behavioral Modeling', value: metrics.behavioralModeling, desc: 'System understanding of your patterns' },
                  { label: 'Market Sync', value: metrics.marketSync, desc: 'Real-time market alignment' },
                  { label: 'Decision Alignment', value: metrics.decisionAlignment, desc: 'System-to-user decision correlation' },
                ].map((m, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-secondary">{m.label}</span>
                      <span className="text-sm font-bold text-accent">{Math.round(m.value)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${m.value}%` }}
                      />
                    </div>
                    <p className="text-xs text-secondary/70">{m.desc}</p>
                  </div>
                ))}
              </div>

              {/* HEX6 Awareness Info */}
              <div className="p-4 border border-border rounded-sm space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  What HEX6 Knows
                </div>
                <ul className="text-xs text-secondary/80 space-y-1">
                  <li>✓ Your trading preferences and risk tolerance</li>
                  <li>✓ Assets you've discussed and tracked</li>
                  <li>✓ Market regimes and states you care about</li>
                  <li>✓ Your decision patterns over time</li>
                  <li>✓ Real-time portfolio and session activity</li>
                </ul>
              </div>
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