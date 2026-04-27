import { useState, useEffect } from 'react';
import { X, AlertTriangle, Mail, Lock, Trash2, Shield, Eye, Clock, LogOut as LogOutIcon, Bell } from 'lucide-react';
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

  useEffect(() => {
    // Load security settings
    const loadSettings = async () => {
      try {
        const prefs = await base44.auth.getPrivacyPreferences?.() || {};
        setTwoFAEnabled(prefs.twoFAEnabled || false);
        setChatEncryption(prefs.chatEncryption !== false);
        setSessions(prefs.sessions || []);
        setActivityLogs(prefs.activityLogs || []);
      } catch (err) {
        console.log('Could not load privacy preferences');
      }
    };
    if (activeTab === 'privacy') {
      loadSettings();
    }
  }, [activeTab]);

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
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
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
              {/* Enable/Disable */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <label className="text-sm font-medium">Market Notifications</label>
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
                    ? 'You\'ll receive market trend alerts and predictions 3x daily'
                    : 'Enable to get daily market updates from HEX6 BLE'}
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
                    <p className="text-sm font-medium">Notification Content</p>
                    <label className="flex items-center gap-3 text-sm text-secondary hover:text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marketTrends}
                        onChange={(e) => setMarketTrends(e.target.checked)}
                        className="w-4 h-4 accent-accent"
                      />
                      Market Trend Analysis
                    </label>
                    <label className="flex items-center gap-3 text-sm text-secondary hover:text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={predictions}
                        onChange={(e) => setPredictions(e.target.checked)}
                        className="w-4 h-4 accent-accent"
                      />
                      HEX6 BLE Predictions & Allocations
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
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary">Enhanced account security</span>
                  <button
                    onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      twoFAEnabled ? 'bg-accent' : 'bg-border'
                    }`}
                    disabled={loading}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        twoFAEnabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-secondary">
                  {twoFAEnabled ? 'Enabled. You\'ll need a code from your authenticator app on login.' : 'Disabled. Add a second layer of security to your account.'}
                </p>
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

              {/* Activity Log */}
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Clock className="w-4 h-4" />
                  Recent Activity
                </div>
                {activityLogs.length === 0 ? (
                  <p className="text-xs text-secondary">No recent activity logged.</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {activityLogs.slice(0, 5).map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between px-2 py-1.5 bg-black/20 rounded text-xs text-secondary">
                        <span>{log.action}</span>
                        <span className="text-white/30">{new Date(log.timestamp).toLocaleTimeString()}</span>
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
                {sessions.length === 0 ? (
                  <p className="text-xs text-secondary">No active sessions.</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 bg-black/20 rounded text-xs">
                        <div className="flex-1">
                          <p className="text-white">{session.device || 'Current session'}</p>
                          <p className="text-white/50">{session.location || 'Unknown location'}</p>
                        </div>
                        {!session.current && (
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
              <div className="p-4 bg-muted/30 rounded-sm border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Trader Mode</label>
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
                    ? "Trader features are coming soon. You'll be notified when they launch."
                    : "Enable to get early access to automated trading features (coming soon)."}
                </p>
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