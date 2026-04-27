import { useState } from 'react';
import { X, AlertTriangle, Mail, Lock, Trash2 } from 'lucide-react';
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
        <div className="flex border-b border-border shrink-0">
          {[
            { id: 'account', label: 'Account' },
            { id: 'security', label: 'Security' },
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